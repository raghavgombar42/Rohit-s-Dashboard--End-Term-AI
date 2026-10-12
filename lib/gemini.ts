import { z } from "zod";
import { db } from "./db";
import { GEMINI_MODEL, env } from "./env";

/**
 * The only door to an LLM in this app: Google Gemini Flash, reached through the OpenRouter gateway
 * (key issued by the course; Google AI Studio is never called directly).
 *
 * Rules enforced here (from the course key document):
 * - Only "google/..." model IDs. Every request pins Google's own infrastructure:
 *   provider.only = google-vertex | google-ai-studio, allow_fallbacks = false.
 * - The model ID is checked against OpenRouter's live model list before a pipeline run.
 * - 429 / 5xx → retry with backoff up to 3 times. 402 (out of credits) → stop everything.
 * - Structured output: the zod schema becomes a strict JSON Schema, and the reply is re-validated with zod.
 * - Every call is logged to llm_calls with tokens, latency and the cost reported by OpenRouter.
 */

const BASE_URL = "https://openrouter.ai/api/v1";
const GOOGLE_ONLY = { only: ["google-vertex", "google-ai-studio"], allow_fallbacks: false, require_parameters: true };

export type Purpose = "triage" | "extract" | "website" | "research" | "fit" | "email";
export type Thinking = "MINIMAL" | "LOW" | "MEDIUM";

type Usage = { tokensIn: number; tokensOut: number; latencyMs: number; costUsd: number | null };

export class GeminiError extends Error {}
/** 402 from OpenRouter: the key has no credit left. Never retried; the pipeline stops calling the model. */
export class OutOfCreditsError extends GeminiError {}

let creditsExhausted = false;

export function modelId(): string {
  const raw = GEMINI_MODEL();
  const id = raw.includes("/") ? raw : `google/${raw}`;
  if (!id.startsWith("google/")) throw new GeminiError(`Only Google models are allowed; got "${id}"`);
  return id;
}

let modelCheck: { id: string; ok: boolean; at: number } | null = null;

/** Rule: confirm the model still exists on OpenRouter before using it (cached for 1 hour). */
export async function ensureModelAvailable(): Promise<{ ok: boolean; id: string; message?: string }> {
  const id = modelId();
  if (modelCheck && modelCheck.id === id && Date.now() - modelCheck.at < 3_600_000) return { ok: modelCheck.ok, id };
  const res = await fetch(`${BASE_URL}/models`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!res.ok) return { ok: true, id, message: `Could not list models (HTTP ${res.status}); continuing` };
  const list = ((await res.json()) as { data?: { id: string }[] }).data ?? [];
  const ok = list.some((m) => m.id === id);
  modelCheck = { id, ok, at: Date.now() };
  return ok ? { ok, id } : { ok, id, message: `Model ${id} is no longer listed on OpenRouter; set GEMINI_MODEL to another google/ Flash model` };
}

function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

function retryDelayMs(attempt: number, retryAfter: string | null): number {
  const s = Number(retryAfter);
  if (Number.isFinite(s) && s > 0) return Math.min(s * 1000, 30_000);
  return Math.min(1000 * 2 ** attempt, 15_000) + Math.random() * 500;
}

async function logCall(runId: number | null, purpose: Purpose, model: string, ok: boolean, usage: Partial<Usage>, error?: string) {
  try {
    await db()`
      insert into llm_calls (run_id, purpose, model, tokens_in, tokens_out, latency_ms, ok, error, cost_usd)
      values (${runId}, ${purpose}, ${model}, ${usage.tokensIn ?? null}, ${usage.tokensOut ?? null},
              ${usage.latencyMs ?? null}, ${ok}, ${error?.slice(0, 500) ?? null}, ${usage.costUsd ?? null})`;
  } catch {
    /* logging must never break the pipeline */
  }
}

type ORResponse = {
  model?: string;
  provider?: string;
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
    cost_details?: { upstream_inference_cost?: number };
  };
  error?: { code?: number; message?: string };
};

/** Gemini sometimes wraps JSON in ```json fences when a tool (web search) is on; strip them. */
function parseJsonLoose(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new GeminiError("Invalid JSON from Gemini");
  }
}

export async function generateJSON<S extends z.ZodType>(opts: {
  purpose: Purpose;
  system: string;
  prompt: string;
  schema: S;
  thinking?: Thinking;
  runId?: number | null;
  maxOutputTokens?: number;
  /** Let Gemini use Google's native web search. Its output is still treated as a proposal and verified by code. */
  googleSearch?: boolean;
}): Promise<{ data: z.infer<S>; usage: Usage }> {
  if (creditsExhausted) throw new OutOfCreditsError("OpenRouter key is out of credits (402); AI calls stopped");
  const model = modelId();
  const schemaJson = toJsonSchema(opts.schema);
  const maxRetries = 3;
  let lastError: unknown;

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.prompt },
    ],
    temperature: 0,
    // Thinking tokens count against the output budget; keep it generous so JSON is never cut off.
    max_tokens: opts.maxOutputTokens ?? 8192,
    reasoning: { effort: (opts.thinking ?? "LOW").toLowerCase(), exclude: true },
    provider: GOOGLE_ONLY,
    usage: { include: true },
  };
  if (opts.googleSearch) {
    // Native Google search does not combine reliably with strict JSON mode, so the schema goes into the
    // prompt instead and the reply is parsed leniently, then validated with zod like every other call.
    body.plugins = [{ id: "web", engine: "native", max_results: 5 }];
    body.provider = { only: GOOGLE_ONLY.only, allow_fallbacks: false };
    (body.messages as { content: string }[])[0].content +=
      `\n\nReply with JSON only (no prose, no code fences) matching this JSON Schema:\n${JSON.stringify(schemaJson)}`;
  } else {
    body.response_format = { type: "json_schema", json_schema: { name: opts.purpose, strict: true, schema: schemaJson } };
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const started = Date.now();
    let status = 0;
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env("OPENROUTER_API_KEY")}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://tandem-forge-outreach.vercel.app",
          "X-Title": "Tandem Forge Funding Outreach Engine",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(120_000),
      });
      status = res.status;
      const json = (await res.json().catch(() => ({}))) as ORResponse;
      if (!res.ok || json.error) {
        const code = json.error?.code ?? res.status;
        const msg = `OpenRouter ${code}: ${json.error?.message ?? res.statusText}`;
        if (code === 402) {
          creditsExhausted = true;
          throw new OutOfCreditsError(msg);
        }
        const err = new GeminiError(msg) as GeminiError & { status?: number; retryAfter?: string | null };
        err.status = code;
        err.retryAfter = res.headers.get("retry-after");
        throw err;
      }
      const usage: Usage = {
        tokensIn: json.usage?.prompt_tokens ?? 0,
        tokensOut: json.usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - started,
        costUsd: json.usage?.cost || json.usage?.cost_details?.upstream_inference_cost || null,
      };
      const text = json.choices?.[0]?.message?.content ?? "";
      if (!text) throw new GeminiError(`Empty reply (finish: ${json.choices?.[0]?.finish_reason ?? "?"})`);
      const parsed = opts.googleSearch ? parseJsonLoose(text) : (() => {
        try { return JSON.parse(text); } catch { throw new GeminiError(`Invalid JSON from Gemini (finish: ${json.choices?.[0]?.finish_reason ?? "?"})`); }
      })();
      const checked = opts.schema.safeParse(parsed);
      if (!checked.success) throw new GeminiError(`Schema validation failed: ${checked.error.message.slice(0, 300)}`);
      await logCall(opts.runId ?? null, opts.purpose, model, true, usage);
      return { data: checked.data, usage };
    } catch (e) {
      lastError = e;
      const s = (e as { status?: number }).status ?? status;
      await logCall(opts.runId ?? null, opts.purpose, model, false, { latencyMs: Date.now() - started }, (e as Error).message);
      if (e instanceof OutOfCreditsError) throw e;
      // Retry: rate limits, server errors, network timeouts, and malformed/invalid model output.
      const retryable = s === 429 || s >= 500 || s === 0 || (e instanceof GeminiError && !(s >= 400 && s < 500));
      if (!retryable || attempt === maxRetries) break;
      await new Promise((r) => setTimeout(r, retryDelayMs(attempt, (e as { retryAfter?: string | null }).retryAfter ?? null)));
    }
  }
  throw new GeminiError(`Gemini ${opts.purpose} failed: ${(lastError as Error)?.message ?? lastError}`);
}
