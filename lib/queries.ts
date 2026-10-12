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
    where not r.is_replay and r.status <> 'not_qualified' -- non-fits are audit-only (PDF: Rohit never sees them)
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
  const [row] = await db()<{ articles: number; funding: number; rounds_pass: number; rounds_fresh: number; filtered: number; qualified: number; not_fit: number; drafted: number }[]>`
    select
      (select count(*) from articles where not is_replay and (reject_reason is null or reject_reason not like 'duplicate_of:%'))::int as articles,
      (select count(*) from articles where not is_replay and status in ('candidate','linked','rejected') and (reject_reason is null or reject_reason not like 'duplicate_of:%'))::int as funding,
      (select count(*) from funding_rounds where not is_replay)::int as rounds_pass,
      (select count(*) from funding_rounds where not is_replay and recency_lane = 'fresh')::int as rounds_fresh,
      (select count(*) from articles a, jsonb_array_elements(a.extraction->'rounds') x where x->>'outcome' like 'rejected:%')::int as filtered,
      (select count(*) from funding_rounds where not is_replay and status in ('qualified','drafted'))::int as qualified,
      (select count(*) from funding_rounds where not is_replay and status = 'not_qualified')::int as not_fit,
      (select count(*) from outreach where not is_replay)::int as drafted`;
  return row;
}

export type ScoredCriterionRow = { score: number; ai_score: number; weight: number; evidence: string | null; evidence_verified: boolean; reasoning: string };
export type ResearchFact = { category: string; claim: string; source_id: string; quote: string; source_url: string };
export type AssessedRow = RoundRow & {
  total: string;
  qualified: boolean;
  summary: string | null;
  thesis_version: number;
  gate_failures: string[];
  criteria_scores: Record<string, ScoredCriterionRow> & { _meta?: { primary_sector?: string; business_model?: string } };
  research: {
    one_liner: string; product: string | null; customers: string | null; business_model: string;
    facts: ResearchFact[]; facts_dropped: number;
    website: { url: string; method: string } | null;
    sources: { id: string; kind: string; url: string; title: string }[];
  } | null;
  assessed_at: Date;
};

/** Latest assessment per round. qualified=true → Rohit's view; false → audit only. */
export async function listAssessed(qualified: boolean, limit = 100) {
  return db()<AssessedRow[]>`
    select r.id, s.id as startup_id, s.name, s.domain, s.hq_city, s.country, s.description, s.founders, s.needs_review,
           r.stage, r.stage_basis, r.amount_text, r.announced_on, r.date_source, r.recency_lane, r.age_hours_at_discovery,
           r.investors, r.evidence, r.status, r.status_reason, r.created_at, r.research,
           '[]'::json as sources,
           a.total, a.qualified, a.summary, a.thesis_version, a.gate_failures, a.criteria_scores, a.created_at as assessed_at
    from funding_rounds r
    join startups s on s.id = r.startup_id
    join lateral (select * from assessments x where x.round_id = r.id order by x.id desc limit 1) a on true
    where not r.is_replay and a.qualified = ${qualified}
    order by a.total desc
    limit ${limit}`;
}

export type OutreachRow = {
  id: string; startup: string; domain: string | null; status: string; subject: string; body: string;
  intended_to: string | null; intended_to_name: string | null; intended_to_source: string | null; intended_to_status: string | null;
  sent_to: string; gmail_draft_id: string | null; gmail_message_id: string | null; reject_reason: string | null; last_error: string | null;
  created_at: Date; approved_at: Date | null; sent_at: Date | null; total: string | null; stage: string; amount_text: string | null;
  recency_lane: "fresh" | "late_catch"; is_replay: boolean;
};

export async function listOutreach() {
  return db()<OutreachRow[]>`
    select o.id, s.name as startup, s.domain, o.status, o.subject, o.body, o.intended_to, o.intended_to_name, o.intended_to_source,
           o.intended_to_status, o.sent_to, o.gmail_draft_id, o.gmail_message_id, o.reject_reason, o.last_error,
           o.created_at, o.approved_at, o.sent_at, a.total, r.stage, r.amount_text, r.recency_lane, o.is_replay
    from outreach o
    join startups s on s.id = o.startup_id
    join funding_rounds r on r.id = o.round_id
    left join assessments a on a.id = o.assessment_id
    order by case o.status when 'drafted_gmail' then 0 when 'drafted_db' then 1 when 'sending' then 2 when 'failed' then 3 else 4 end,
             o.created_at desc`;
}

// ---------- Overview charts (all real data) ----------


/** Unique articles and funding stories per IST day for the last N days (zero-filled). */
export async function dailyNews(days = 14) {
  return db()<{ day: string; label: string; articles: number; funding: number }[]>`
    with d as (
      select generate_series((now() at time zone 'Asia/Kolkata')::date - ${days - 1}::int, (now() at time zone 'Asia/Kolkata')::date, interval '1 day')::date as day
    )
    select to_char(d.day, 'YYYY-MM-DD') as day, to_char(d.day, 'DD Mon') as label,
           count(a.id)::int as articles,
           count(a.id) filter (where a.status in ('candidate', 'linked', 'rejected'))::int as funding
    from d left join articles a
      on (coalesce(a.published_at, a.first_seen_at) at time zone 'Asia/Kolkata')::date = d.day
     and not a.is_replay and (a.reject_reason is null or a.reject_reason not like 'duplicate_of:%')
    group by d.day order by d.day`;
}

/** What happened to every round Gemini extracted: first hard-gate reason, thesis non-fit, or qualified. */
export async function roundOutcomes() {
  const sql = db();
  const gate = await sql<{ reason: string; n: number }[]>`
    select case
             when x->>'outcome' like '%stage_not_in_thesis%' then 'Wrong stage'
             when x->>'outcome' like '%geography%' then 'Outside India'
             when x->>'outcome' like '%stale%' then 'Too old'
             when x->>'outcome' like '%old_round%' then 'Old news'
             else 'Unverified'
           end as reason, count(*)::int as n
    from articles a, jsonb_array_elements(a.extraction->'rounds') x
    where x->>'outcome' like 'rejected:%' and not a.is_replay
    group by 1`;
  const [fit] = await sql<{ qualified: number; not_fit: number }[]>`
    select count(*) filter (where status in ('qualified', 'drafted'))::int as qualified,
           count(*) filter (where status = 'not_qualified')::int as not_fit
    from funding_rounds where not is_replay`;
  return [...gate.sort((a, b) => b.n - a.n), { reason: "Not a thesis fit", n: fit.not_fit }, { reason: "Qualified", n: fit.qualified }].filter((r) => r.n > 0);
}

/** Funding stories by IST weekday (0=Mon) × 4-hour block (0 = 00–04 … 5 = 20–24). */
export async function newsHeatmap() {
  return db()<{ dow: number; block: number; n: number }[]>`
    select ((extract(isodow from t)::int) - 1) as dow, (extract(hour from t)::int / 4) as block, count(*)::int as n
    from (select (coalesce(published_at, first_seen_at) at time zone 'Asia/Kolkata') as t
          from articles
          where not is_replay and status in ('candidate', 'linked', 'rejected')
            and (reject_reason is null or reject_reason not like 'duplicate_of:%')) s
    group by 1, 2`;
}
