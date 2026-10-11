-- 001_schema.sql — core tables for the Timed Funding Outreach Engine.
-- Rule of thumb: anything that must be predictable (dedup, state, one-outreach-per-startup)
-- is enforced here by constraints, not by prompts or app code alone.

-- ---------- Sources & articles ----------
create table sources (
  id          text primary key,                       -- slug, e.g. 'inc42'
  name        text not null,
  kind        text not null check (kind in ('rss', 'google_news')),
  url         text not null,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now()
);

create table pipeline_runs (
  id           bigint generated always as identity primary key,
  trigger      text not null check (trigger in ('cron_hourly', 'cron_daily', 'manual', 'replay', 'test')),
  status       text not null default 'running' check (status in ('running', 'succeeded', 'partial', 'failed')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  counts       jsonb not null default '{}'::jsonb,
  error        text
);
-- Run lock: at most one running pipeline at a time. A second trigger fails to insert.
create unique index pipeline_runs_one_running on pipeline_runs ((true)) where status = 'running';

create table articles (
  id             bigint generated always as identity primary key,
  source_id      text not null references sources(id),
  url            text not null,
  url_canonical  text not null unique,                 -- article-level dedup
  title          text not null,
  title_hash     text not null,                        -- syndicated copies on different URLs
  snippet        text,
  publisher      text,
  published_at   timestamptz,
  first_seen_at  timestamptz not null default now(),
  body_text      text,
  status         text not null default 'new'
                 check (status in ('new', 'not_funding', 'candidate', 'rejected', 'linked', 'error')),
  reject_reason  text,
  attempts       int not null default 0,
  last_error     text,
  round_id       bigint,                               -- FK added below
  run_id         bigint references pipeline_runs(id),
  is_replay      boolean not null default false
);
create index articles_status_idx on articles (status);
create index articles_title_hash_idx on articles (title_hash);
create index articles_published_idx on articles (published_at desc);

-- ---------- Startups & rounds ----------
create table startups (
  id               bigint generated always as identity primary key,
  name             text not null,
  name_normalized  text not null,
  domain           text unique,                        -- strongest identity key when known
  website          text,
  hq_city          text,
  country          text,
  description      text,
  founders         jsonb not null default '[]'::jsonb, -- [{name, role, source_quote}]
  needs_review     boolean not null default false,
  created_at       timestamptz not null default now()
);
create index startups_name_norm_idx on startups (name_normalized);

create table funding_rounds (
  id              bigint generated always as identity primary key,
  startup_id      bigint not null references startups(id),
  stage           text not null,
  amount          numeric,
  currency        text,
  amount_text     text,                                -- as written in the source, e.g. "$2.5 Mn"
  announced_on    date not null,
  date_source     text not null check (date_source in ('stated_in_article', 'article_published')),
  announced_week  date generated always as ((date_trunc('week', announced_on::timestamp))::date) stored,
  investors       jsonb not null default '[]'::jsonb,
  evidence        jsonb not null default '{}'::jsonb,  -- {field: verbatim quote}
  recency_lane    text not null check (recency_lane in ('fresh', 'late_catch')),
  status          text not null default 'new'
                  check (status in ('new', 'enriched', 'qualified', 'not_qualified', 'drafted',
                                    'already_contacted', 'needs_review', 'error')),
  status_reason   text,
  research        jsonb,                               -- evidence-backed brief
  attempts        int not null default 0,
  last_error      text,
  is_replay       boolean not null default false,
  created_at      timestamptz not null default now(),
  -- funding-announcement dedup backstop: 5 outlets covering one round collapse to one row
  unique (startup_id, stage, announced_week)
);
create index funding_rounds_status_idx on funding_rounds (status);

alter table articles add constraint articles_round_fk foreign key (round_id) references funding_rounds(id);

create table round_sources (
  round_id    bigint not null references funding_rounds(id) on delete cascade,
  article_id  bigint not null references articles(id) on delete cascade,
  primary key (round_id, article_id)
);

-- ---------- Thesis (editable by Rohit) + immutable version history ----------
create table thesis (
  id                  int primary key default 1 check (id = 1),   -- singleton row
  version             int not null default 1,
  accelerator_name    text not null,
  summary             text not null,                 -- "what we look for", plain English
  sectors             text[] not null,
  excluded_sectors    text[] not null default '{}',
  stages              text[] not null,               -- allowed funding stages (hard gate)
  geographies         text[] not null,               -- allowed HQ countries (hard gate)
  business_models     text[] not null default '{}',
  criteria            jsonb not null,                -- {key: {weight, description}}
  threshold           numeric not null check (threshold between 0 and 100),
  fresh_window_hours  int not null default 24 check (fresh_window_hours between 1 and 168),
  late_catch_days     int not null default 30 check (late_catch_days between 0 and 60),
  program_pitch       text not null,                 -- what the accelerator offers, used in emails
  sender_name         text not null,
  sender_title        text not null,
  updated_at          timestamptz not null default now()
);

create table thesis_versions (
  version     int primary key,
  snapshot    jsonb not null,
  created_at  timestamptz not null default now()
);

-- Validate a thesis edit so a typo in the Table Editor fails loudly instead of breaking scoring.
create or replace function thesis_validate() returns trigger language plpgsql as $$
declare
  k text; v jsonb; total numeric := 0;
begin
  if jsonb_typeof(new.criteria) <> 'object' or new.criteria = '{}'::jsonb then
    raise exception 'thesis.criteria must be a non-empty JSON object of {key: {weight, description}}';
  end if;
  for k, v in select * from jsonb_each(new.criteria) loop
    if jsonb_typeof(v->'weight') <> 'number' or (v->>'weight')::numeric < 0 then
      raise exception 'criteria.% needs a non-negative numeric "weight"', k;
    end if;
    if coalesce(v->>'description', '') = '' then
      raise exception 'criteria.% needs a "description"', k;
    end if;
    total := total + (v->>'weight')::numeric;
  end loop;
  if total <= 0 then raise exception 'criteria weights must sum to more than 0'; end if;
  if cardinality(new.stages) = 0 then raise exception 'thesis.stages cannot be empty'; end if;
  if cardinality(new.geographies) = 0 then raise exception 'thesis.geographies cannot be empty'; end if;
  return new;
end $$;

-- Every real edit bumps the version and snapshots it, so each assessment is traceable.
create or replace function thesis_version_bump() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'version' - 'updated_at') = (to_jsonb(old) - 'version' - 'updated_at') then
      new.version := old.version;            -- no-op edit: keep version
      return new;
    end if;
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function thesis_snapshot() returns trigger language plpgsql as $$
begin
  insert into thesis_versions (version, snapshot) values (new.version, to_jsonb(new))
  on conflict (version) do nothing;
  return null;
end $$;

create or replace function thesis_no_delete() returns trigger language plpgsql as $$
begin
  raise exception 'The thesis row cannot be deleted; edit it instead.';
end $$;

create trigger thesis_10_validate before insert or update on thesis
  for each row execute function thesis_validate();
create trigger thesis_20_version before insert or update on thesis
  for each row execute function thesis_version_bump();
create trigger thesis_30_snapshot after insert or update on thesis
  for each row execute function thesis_snapshot();
create trigger thesis_40_no_delete before delete on thesis
  for each row execute function thesis_no_delete();

-- ---------- Assessments ----------
create table assessments (
  id               bigint generated always as identity primary key,
  round_id         bigint not null references funding_rounds(id),
  thesis_version   int not null references thesis_versions(version),
  gate_failures    text[] not null default '{}',
  criteria_scores  jsonb not null default '{}'::jsonb,   -- {key: {score, weight, evidence, reasoning}}
  total            numeric,
  qualified        boolean not null,
  summary          text,
  created_at       timestamptz not null default now()
);
create index assessments_round_idx on assessments (round_id);

-- ---------- Outreach (drafts + contact history) ----------
create table outreach (
  id                  bigint generated always as identity primary key,
  startup_id          bigint not null references startups(id),
  round_id            bigint not null references funding_rounds(id),
  assessment_id       bigint not null references assessments(id),
  intended_to         text,                             -- founder email if found; NEVER used as recipient
  intended_to_name    text,
  intended_to_source  text,                             -- 'website' | 'hunter' | null
  intended_to_status  text,                             -- 'verified' | 'published_on_site' | 'unverified' | 'not_found'
  sent_to             text not null,                    -- safe-mode override inbox
  subject             text not null,
  body                text not null,
  hooks               jsonb not null default '[]'::jsonb,
  gmail_draft_id      text,
  gmail_message_id    text,
  status              text not null default 'drafted_db'
                      check (status in ('drafted_db', 'drafted_gmail', 'sending', 'sent', 'rejected', 'failed')),
  reject_reason       text,
  last_error          text,
  is_replay           boolean not null default false,
  created_at          timestamptz not null default now(),
  approved_at         timestamptz,
  sent_at             timestamptz
);
-- No duplicate outreach: only one live (non-rejected) outreach per startup, ever.
-- Sent rows are never deleted, so a contacted startup can never get a second draft.
create unique index outreach_one_live_per_startup on outreach (startup_id) where status <> 'rejected';

-- ---------- Observability ----------
create table run_events (
  id           bigint generated always as identity primary key,
  run_id       bigint references pipeline_runs(id),
  level        text not null check (level in ('info', 'warn', 'error')),
  stage        text not null,
  entity_type  text,
  entity_id    bigint,
  message      text not null,
  data         jsonb,
  created_at   timestamptz not null default now()
);
create index run_events_run_idx on run_events (run_id, created_at);

create table llm_calls (
  id           bigint generated always as identity primary key,
  run_id       bigint references pipeline_runs(id),
  purpose      text not null,                          -- triage | extract | research | fit | email
  model        text not null,
  tokens_in    int,
  tokens_out   int,
  latency_ms   int,
  ok           boolean not null,
  error        text,
  created_at   timestamptz not null default now()
);

create table integrations (
  provider           text primary key,                 -- 'gmail'
  account_email      text,
  refresh_token_enc  text,                             -- AES-256-GCM, key in env
  scopes             text,
  connected_at       timestamptz,
  last_ok_at         timestamptz,
  last_error         text
);

-- Lock everything down from Supabase's public APIs. The app connects server-side as the
-- database owner; the browser never talks to Supabase directly.
alter table sources          enable row level security;
alter table pipeline_runs    enable row level security;
alter table articles         enable row level security;
alter table startups         enable row level security;
alter table funding_rounds   enable row level security;
alter table round_sources    enable row level security;
alter table thesis           enable row level security;
alter table thesis_versions  enable row level security;
alter table assessments      enable row level security;
alter table outreach         enable row level security;
alter table run_events       enable row level security;
alter table llm_calls        enable row level security;
alter table integrations     enable row level security;
