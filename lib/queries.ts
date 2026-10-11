import { db } from "./db";

export type ArticleRow = {
  id: string;
  title: string;
  url: string;
  publisher: string | null;
  source_id: string;
  source_name: string;
  published_at: Date | null;
  first_seen_at: Date;
  status: string;
  reject_reason: string | null;
  is_replay: boolean;
};

export type RunRow = {
  id: string;
  trigger: string;
  status: string;
  started_at: Date;
  finished_at: Date | null;
  counts: Record<string, number>;
  error: string | null;
};

export async function overviewStats() {
  const [row] = await db()<
    { new_24h: number; total: number; dupes: number; sources_on: number; drafts: number; sent: number }[]
  >`
    select
      (select count(*) from articles where not is_replay and first_seen_at > now() - interval '24 hours')::int as new_24h,
      (select count(*) from articles where not is_replay)::int as total,
      (select count(*) from articles where reject_reason like 'duplicate_of:%')::int as dupes,
      (select count(*) from sources where enabled)::int as sources_on,
      (select count(*) from outreach where status in ('drafted_db','drafted_gmail') and not is_replay)::int as drafts,
      (select count(*) from outreach where status = 'sent')::int as sent`;
  return row;
}

export async function listRuns(limit = 30) {
  return db()<RunRow[]>`
    select id, trigger, status, started_at, finished_at, counts, error
    from pipeline_runs where trigger <> 'test' order by started_at desc limit ${limit}`;
}

export async function getRun(id: number) {
  const sql = db();
  const [run] = await sql<RunRow[]>`select id, trigger, status, started_at, finished_at, counts, error from pipeline_runs where id = ${id}`;
  if (!run) return null;
  const events = await sql<{ id: string; level: string; stage: string; message: string; created_at: Date }[]>`
    select id, level, stage, message, created_at from run_events where run_id = ${id} order by id`;
  return { run, events };
}

export type DiscoveryFilter = { window: "24h" | "7d" | "all"; view: "all" | "unique" | "duplicates" };

export async function listArticles(f: DiscoveryFilter, limit = 200) {
  const sql = db();
  const since =
    f.window === "24h" ? sql`and coalesce(a.published_at, a.first_seen_at) > now() - interval '24 hours'`
    : f.window === "7d" ? sql`and coalesce(a.published_at, a.first_seen_at) > now() - interval '7 days'`
    : sql``;
  const view =
    f.view === "duplicates" ? sql`and a.reject_reason like 'duplicate_of:%'`
    : f.view === "unique" ? sql`and (a.reject_reason is null or a.reject_reason not like 'duplicate_of:%')`
    : sql``;
  return sql<ArticleRow[]>`
    select a.id, a.title, a.url, a.publisher, a.source_id, s.name as source_name, a.published_at, a.first_seen_at,
           a.status, a.reject_reason, a.is_replay
    from articles a join sources s on s.id = a.source_id
    where not a.is_replay ${since} ${view}
    order by coalesce(a.published_at, a.first_seen_at) desc
    limit ${limit}`;
}

export async function sourceHealth() {
  return db()<{ id: string; name: string; kind: string; enabled: boolean; total: number; last_24h: number; latest: Date | null }[]>`
    select s.id, s.name, s.kind, s.enabled,
           count(a.id)::int as total,
           count(a.id) filter (where a.first_seen_at > now() - interval '24 hours')::int as last_24h,
           max(a.published_at) as latest
    from sources s left join articles a on a.source_id = s.id and not a.is_replay
    group by s.id order by s.enabled desc, total desc`;
}

export type RoundRow = {
  id: string;
  startup_id: string;
  name: string;
  domain: string | null;
  hq_city: string | null;
  country: string | null;
  description: string | null;
  founders: { name: string; role: string | null }[];
  needs_review: boolean;
  stage: string;
  stage_basis: string | null;
  amount_text: string | null;
  announced_on: string;
  date_source: string;
  recency_lane: "fresh" | "late_catch";
  age_hours_at_discovery: string | null;
  investors: string[];
  evidence: Record<string, unknown> & { notes?: string[] };
  status: string;
  status_reason: string | null;
  created_at: Date;
  sources: { title: string; url: string; publisher: string | null; published_at: Date | null }[];
};

export async function listRounds(limit = 100) {
  return db()<RoundRow[]>`
    select r.id, s.id as startup_id, s.name, s.domain, s.hq_city, s.country, s.description, s.founders, s.needs_review,
           r.stage, r.stage_basis, r.amount_text, r.announced_on, r.date_source, r.recency_lane, r.age_hours_at_discovery,
           r.investors, r.evidence, r.status, r.status_reason, r.created_at,
           coalesce((select json_agg(json_build_object('title', a.title, 'url', a.url, 'publisher', a.publisher, 'published_at', a.published_at)
                                     order by a.published_at)
                     from round_sources rs join articles a on a.id = rs.article_id where rs.round_id = r.id), '[]') as sources
    from funding_rounds r join startups s on s.id = r.startup_id
    where not r.is_replay
    order by r.announced_on desc, r.id desc
    limit ${limit}`;
}

export type FilteredRow = { article_id: string; title: string; url: string; publisher: string | null; published_at: Date | null; startup: string; outcome: string; notes: string[] | null };

/** Every per-round decision the rules made against, from the extraction audit trail. */
export async function listFilteredOut(limit = 200) {
  return db()<FilteredRow[]>`
    select a.id as article_id, a.title, a.url, a.publisher, a.published_at,
           x->>'startup' as startup, x->>'outcome' as outcome,
           (select array_agg(n) from jsonb_array_elements_text(x->'notes') n) as notes
    from articles a, jsonb_array_elements(a.extraction->'rounds') x
    where a.extraction is not null and x->>'outcome' like 'rejected:%' and not a.is_replay
    order by a.published_at desc nulls last
    limit ${limit}`;
}

export async function funnelCounts() {
  const [row] = await db()<{ articles: number; funding: number; rounds_pass: number; rounds_fresh: number; filtered: number }[]>`
    select
      (select count(*) from articles where not is_replay and (reject_reason is null or reject_reason not like 'duplicate_of:%'))::int as articles,
      (select count(*) from articles where not is_replay and status in ('candidate','linked','rejected') and (reject_reason is null or reject_reason not like 'duplicate_of:%'))::int as funding,
      (select count(*) from funding_rounds where not is_replay)::int as rounds_pass,
      (select count(*) from funding_rounds where not is_replay and recency_lane = 'fresh')::int as rounds_fresh,
      (select count(*) from articles a, jsonb_array_elements(a.extraction->'rounds') x where x->>'outcome' like 'rejected:%')::int as filtered`;
  return row;
}
