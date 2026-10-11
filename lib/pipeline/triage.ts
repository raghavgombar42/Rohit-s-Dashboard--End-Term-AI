import { db } from "../db";
import { generateJSON } from "../gemini";
import { TRIAGE_SYSTEM, triagePrompt } from "../ai/prompts";
import { TriageSchema } from "../funding/schema";
import type { RunContext } from "./context";

const BATCH = 25;

/** S3: Gemini classifies headlines in batches. Cheap filter before any expensive extraction. */
export async function triageStage(ctx: RunContext): Promise<void> {
  const sql = db();
  while (ctx.timeLeft() > 20_000) {
    const batch = await sql<{ id: string; title: string; snippet: string | null; publisher: string | null }[]>`
      select id::text, title, snippet, publisher from articles
      where status = 'new' and attempts < 3
      order by coalesce(published_at, first_seen_at) desc limit ${BATCH}`;
    if (batch.length === 0) return;

    try {
      const { data } = await generateJSON({
        purpose: "triage",
        runId: ctx.runId,
        system: TRIAGE_SYSTEM,
        prompt: triagePrompt(batch),
        schema: TriageSchema,
        thinking: "LOW",
      });
      const byId = new Map(data.results.map((r) => [r.id, r]));
      for (const a of batch) {
        const r = byId.get(a.id);
        if (!r) {
          await sql`update articles set attempts = attempts + 1 where id = ${a.id}`;
          continue;
        }
        await sql`
          update articles set status = ${r.is_funding_news ? "candidate" : "not_funding"},
                 triage_reason = ${r.reason}, is_roundup = ${r.is_roundup}, attempts = 0
          where id = ${a.id} and status = 'new'`;
        ctx.bump(r.is_funding_news ? "triage_funding" : "triage_not_funding");
      }
      await ctx.log("info", "triage", `Classified ${batch.length} headlines: ${data.results.filter((r) => r.is_funding_news).length} funding news`);
    } catch (e) {
      const ids = batch.map((b) => b.id);
      await sql`update articles set attempts = attempts + 1, last_error = ${(e as Error).message.slice(0, 500)} where id = any(${ids}::bigint[])`;
      await sql`update articles set status = 'error' where id = any(${ids}::bigint[]) and attempts >= 3`;
      await ctx.log("error", "triage", `Batch failed: ${(e as Error).message}`);
      return; // likely quota; leave the rest for the next run
    }
  }
}
