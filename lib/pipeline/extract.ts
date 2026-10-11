import { db } from "../db";
import { generateJSON } from "../gemini";
import { EXTRACT_SYSTEM, PROMPT_VERSION, extractPrompt } from "../ai/prompts";
import { ExtractionSchema, MAX_ROUNDS_PER_ARTICLE } from "../funding/schema";
import { applyGates, verifyRound, type GateResult, type VerifiedRound } from "../funding/verify";
import { resolveStartup, upsertRound } from "../funding/identity";
import { fetchArticleText } from "../ingest/article-text";
import { loadActiveThesis } from "../thesis";
import type { RunContext } from "./context";

const CONCURRENCY = 3;
const PER_RUN_LIMIT = 40;

type Candidate = {
  id: number; title: string; url: string; publisher: string | null; published_at: Date | null;
  first_seen_at: Date; body_text: string | null; snippet: string | null; is_replay: boolean;
};

/** S4–S6: extract facts with quotes (Gemini), verify + gate (code), resolve identity and merge rounds (DB). */
export async function extractStage(ctx: RunContext): Promise<void> {
  const sql = db();
  const thesis = await loadActiveThesis();
  const queue = await sql<Candidate[]>`
    select id::int, title, url, publisher, published_at, first_seen_at, body_text, snippet, is_replay
    from articles where status = 'candidate' and attempts < 3
    order by coalesce(published_at, first_seen_at) desc limit ${PER_RUN_LIMIT}`;
  if (queue.length === 0) return;

  let next = 0;
  const worker = async () => {
    while (next < queue.length && ctx.timeLeft() > 25_000) {
      const a = queue[next++];
      try {
        await processArticle(ctx, a, thesis);
      } catch (e) {
        ctx.bump("extract_errors");
        await sql`
          update articles set attempts = attempts + 1, last_error = ${(e as Error).message.slice(0, 500)},
                 status = case when attempts + 1 >= 3 then 'error' else status end
          where id = ${a.id}`;
        await ctx.log("warn", "extract", `Article ${a.id} failed: ${(e as Error).message}`, { entityType: "article", entityId: a.id });
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

// Best available text: own feed body → own page → a syndicated copy's body/page (e.g. a Google News
// headline whose identical story arrived with full text from a direct feed) → snippet → headline only.
async function articleText(a: Candidate): Promise<{ text: string; source: "feed" | "page" | "snippet" | "headline" }> {
  if (a.body_text) return { text: a.body_text, source: "feed" };
  const page = await fetchArticleText(a.url);
  if (page) return { text: page, source: "page" };
  const copies = await db()<{ url: string; body_text: string | null; snippet: string | null }[]>`
    select url, body_text, snippet from articles where reject_reason = ${"duplicate_of:" + a.id} order by body_text is null`;
  for (const c of copies) {
    if (c.body_text) return { text: c.body_text, source: "feed" };
    const p = await fetchArticleText(c.url);
    if (p) return { text: p, source: "page" };
  }
  const snippet = a.snippet ?? copies.find((c) => c.snippet)?.snippet;
  if (snippet) return { text: snippet, source: "snippet" };
  return { text: "", source: "headline" };
}

async function processArticle(ctx: RunContext, a: Candidate, thesis: Awaited<ReturnType<typeof loadActiveThesis>>) {
  const sql = db();
  const { text, source } = await articleText(a);
  const fullSource = `${a.title}\n\n${text}`;

  const { data } = await generateJSON({
    purpose: "extract",
    runId: ctx.runId,
    system: EXTRACT_SYSTEM,
    prompt: extractPrompt({ title: a.title, publisher: a.publisher, publishedAt: a.published_at, text }),
    schema: ExtractionSchema,
    thinking: "LOW",
  });

  const audit: { startup: string; verified: boolean; notes: string[]; gates?: GateResult; round_id?: number; outcome: string }[] = [];
  let linked = 0;

  for (const raw of data.rounds.slice(0, MAX_ROUNDS_PER_ARTICLE)) {
    const v: VerifiedRound | null = verifyRound(raw, fullSource);
    if (!v) {
      audit.push({ startup: raw.startup_name, verified: false, notes: ["startup name/quote not found in text"], outcome: "rejected:unverified_startup" });
      ctx.bump("rounds_unverified");
      continue;
    }
    const g = applyGates({ round: v, publishedAt: a.published_at, discoveredAt: a.first_seen_at }, thesis);
    if (!g.pass) {
      audit.push({ startup: v.startup_name, verified: true, notes: v.notes, gates: g, outcome: `rejected:${g.failures.join(",")}` });
      ctx.bump("rounds_gated_out");
      continue;
    }

    const outcome = await sql.begin(async (tx) => {
      const s = await resolveStartup(tx, v);
      const { roundId, isNew } = await upsertRound(tx, s.id, v, g, a.id, a.is_replay);
      // Never queue a startup we have already contacted (or have a live draft for).
      const [contacted] = await tx`select 1 from outreach where startup_id = ${s.id} and status <> 'rejected' limit 1`;
      if (contacted) await tx`update funding_rounds set status = 'already_contacted', status_reason = 'Startup already has outreach' where id = ${roundId}`;
      else if (s.needsReview) await tx`update funding_rounds set status = 'needs_review', status_reason = 'Name matches another startup with a different website' where id = ${roundId} and status = 'new'`;
      return { roundId, isNew, contacted: !!contacted };
    });
    linked++;
    ctx.bump(outcome.isNew ? "rounds_new" : "rounds_merged");
    audit.push({ startup: v.startup_name, verified: true, notes: v.notes, gates: g, round_id: outcome.roundId, outcome: outcome.contacted ? "already_contacted" : outcome.isNew ? "new_round" : "merged_into_existing_round" });
  }

  const status = linked > 0 ? "linked" : "rejected";
  const reason = linked > 0 ? null : data.rounds.length === 0 ? "no_new_round_in_text" : audit.map((x) => x.outcome.replace("rejected:", "")).join(" | ").slice(0, 300);
  await sql`
    update articles set status = ${status}, reject_reason = ${reason}, text_source = ${source}, attempts = 0,
           body_text = coalesce(body_text, ${source === "page" ? text : null}),
           extraction = ${sql.json({ prompt: PROMPT_VERSION.extract, rounds: audit } as never)},
           round_id = ${audit.find((x) => x.round_id)?.round_id ?? null}
    where id = ${a.id}`;
  ctx.bump("articles_extracted");
}
