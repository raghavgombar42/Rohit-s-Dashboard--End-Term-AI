import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { db } from "./db";
import { GEMINI_MODEL, env } from "./env";

/**
 * The only door to an LLM in this app: Gemini Flash.
 * - Structured output: the zod schema is converted to JSON Schema and enforced by Gemini,
 *   then the reply is validated again with zod (never trust, always verify).
 * - Multiple API keys (comma-separated GEMINI_API_KEY): rotate on 429, drop on 401/403.
 * - Retries with exponential backoff on 429/5xx/invalid JSON. Every call is logged to llm_calls.
 */

export type Purpose = "triage" | "extract" | "research" | "fit" | "email";
export type Thinking = "MINIMAL" | "LOW" | "MEDIUM";

type Usage = { tokensIn: number; tokensOut: number; latencyMs: number };

let clients: { key: string; ai: GoogleGenAI; dead: boolean }[] | null = null;
let cursor = 0;

function getClients() {
  if (!clients) {
    clients = env("GEMINI_API_KEY")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .map((key) => ({ key, ai: new GoogleGenAI({ apiKey: key }), dead: false }));
  }
  const live = clients.filter((c) => !c.dead);
  if (live.length === 0) throw new Error("All Gemini API keys were rejected (401/403)");
  return live;
}

function toGeminiSchema(schema: z.ZodType): unknown {
  const js = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

function statusOf(e: unknown): number | undefined {
  const err = e as { status?: number; code?: number; message?: string };
  if (typeof err.status === "number") return err.status;
  if (typeof err.code === "number") return err.code;
  const m = err.message?.match(/\b(4\d\d|5\d\d)\b/);
  return m ? Number(m[1]) : undefined;
}

function retryDelayMs(e: unknown, attempt: number): number {
  const m = (e as { message?: string }).message?.match(/retry(?:Delay)?["\s:]*(\d+(?:\.\d+)?)s/i);
  if (m) return Math.min(Number(m[1]) * 1000, 30_000);
  return Math.min(1000 * 2 ** attempt, 15_000) + Math.random() * 500;
}

async function logCall(runId: number | null, purpose: Purpose, model: string, ok: boolean, usage: Partial<Usage>, error?: string) {
  try {
    await db()`
      insert into llm_calls (run_id, purpose, model, tokens_in, tokens_out, latency_ms, ok, error)
      values (${runId}, ${purpose}, ${model}, ${usage.tokensIn ?? null}, ${usage.tokensOut ?? null},
              ${usage.latencyMs ?? null}, ${ok}, ${error?.slice(0, 500) ?? null})`;
  } catch {
    /* logging must never break the pipeline */
  }
}

export class GeminiError extends Error {}

export async function generateJSON<S extends z.ZodType>(opts: {
  purpose: Purpose;
  system: string;
  prompt: string;
  schema: S;
  thinking?: Thinking;
  runId?: number | null;
  maxOutputTokens?: number;
  maxAttempts?: number;
}): Promise<{ data: z.infer<S>; usage: Usage }> {
  const model = GEMINI_MODEL();
  const responseJsonSchema = toGeminiSchema(opts.schema);
  const maxAttempts = opts.maxAttempts ?? 4;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const live = getClients();
    const client = live[cursor++ % live.length];
    const started = Date.now();
    try {
      const res = await client.ai.models.generateContent({
        model,
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          temperature: 0,
          responseMimeType: "application/json",
          responseJsonSchema,
          // Thinking tokens count against the output budget; keep it generous so JSON is never cut off.
          maxOutputTokens: opts.maxOutputTokens ?? 8192,
          thinkingConfig: { thinkingLevel: ThinkingLevel[opts.thinking ?? "LOW"] },
        },
      });
      const usage: Usage = {
        tokensIn: res.usageMetadata?.promptTokenCount ?? 0,
        tokensOut: (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0),
        latencyMs: Date.now() - started,
      };
      const text = res.text ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new GeminiError(`Invalid JSON from Gemini (finish: ${res.candidates?.[0]?.finishReason ?? "?"})`);
      }
      const checked = opts.schema.safeParse(parsed);
      if (!checked.success) throw new GeminiError(`Schema validation failed: ${checked.error.message.slice(0, 300)}`);
      await logCall(opts.runId ?? null, opts.purpose, model, true, usage);
      return { data: checked.data, usage };
    } catch (e) {
      lastError = e;
      const status = statusOf(e);
      await logCall(opts.runId ?? null, opts.purpose, model, false, { latencyMs: Date.now() - started }, `${status ?? ""} ${(e as Error).message}`);
      if (status === 401 || status === 403) {
        client.dead = true;
        continue;
      }
      const retryable = e instanceof GeminiError || status === 429 || status === undefined || status >= 500;
      if (!retryable || attempt === maxAttempts - 1) break;
      await new Promise((r) => setTimeout(r, retryDelayMs(e, attempt)));
    }
  }
  throw new GeminiError(`Gemini ${opts.purpose} failed: ${(lastError as Error)?.message ?? lastError}`);
}
