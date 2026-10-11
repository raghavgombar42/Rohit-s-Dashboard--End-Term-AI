import { db } from "../db";
import { fetchFeed, type FeedItem, type Source } from "../ingest/feeds";
import { canonicalUrl, titleHash } from "../text";
import { loadActiveThesis } from "../thesis";
import type { RunContext } from "./context";

/**
 * S1 + S2: fetch every enabled feed in parallel, normalise, and insert new articles.
 * Idempotent: the unique canonical URL makes re-ingesting the same item a no-op.
 * Syndicated copies (same headline, different URL) are stored but marked as duplicates,
 * so they are never sent to Gemini twice.
 */
export async function ingestStage(ctx: RunContext): Promise<void> {
  const sql = db();
  const thesis = await loadActiveThesis();
  // An article older than the late-catch window cannot announce a round we would still act on.
  const maxAgeDays = Math.max(thesis.late_catch_days, Math.ceil(thesis.fresh_window_hours / 24)) + 1;
  const cutoff = new Date(Date.now() - maxAgeDays * 86_400_000);

  const sources = await sql<Source[]>`select id, name, kind, url from sources where enabled order by id`;
  const results = await Promise.allSettled(sources.map((s) => fetchFeed(s)));

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const r = results[i];
    if (r.status === "rejected") {
      ctx.bump("feeds_failed");
      await ctx.log("warn", "ingest", `Feed ${source.name} failed: ${String(r.reason?.message ?? r.reason)}`, { data: { source: source.id } });
      continue;
    }
    ctx.bump("feeds_ok");
    let inserted = 0, dup = 0, old = 0;
    for (const item of r.value) {
      ctx.bump("items_seen");
      if (item.publishedAt && item.publishedAt < cutoff) {
        old++;
        continue;
      }
      const outcome = await insertArticle(ctx, item);
      if (outcome === "inserted") inserted++;
      else if (outcome === "duplicate_title") { inserted++; dup++; }
    }
    ctx.bump("articles_new", inserted);
    ctx.bump("articles_syndicated_dupes", dup);
    ctx.bump("items_too_old", old);
    await ctx.log("info", "ingest", `${source.name}: ${r.value.length} items, ${inserted} new (${dup} syndicated copies), ${old} older than ${maxAgeDays}d`, {
      data: { source: source.id },
    });
  }
}

async function insertArticle(ctx: RunContext, item: FeedItem): Promise<"inserted" | "duplicate_title" | "exists"> {
  const sql = db();
  const urlCanonical = canonicalUrl(item.url);
  const hash = titleHash(item.title);

  // Same headline already stored from another URL in the last 14 days → keep as an extra source, skip AI.
  const [original] = await sql<{ id: number }[]>`
    select id from articles
    where title_hash = ${hash} and url_canonical <> ${urlCanonical}
      and first_seen_at > now() - interval '14 days'
    order by id limit 1`;

  const rows = await sql<{ id: number }[]>`
    insert into articles (source_id, url, url_canonical, title, title_hash, snippet, publisher,
                          published_at, body_text, status, reject_reason, run_id)
    values (${item.sourceId}, ${item.url}, ${urlCanonical}, ${item.title}, ${hash}, ${item.snippet},
            ${item.publisher}, ${item.publishedAt}, ${item.bodyText},
            ${original ? "rejected" : "new"}, ${original ? `duplicate_of:${original.id}` : null}, ${ctx.runId})
    on conflict (url_canonical) do nothing
    returning id`;

  if (rows.length === 0) return "exists";
  return original ? "duplicate_title" : "inserted";
}
