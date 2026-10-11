-- 006 — M4 extraction support.
alter table articles add column text_source text check (text_source in ('feed', 'page', 'snippet', 'headline'));
alter table articles add column extraction jsonb;      -- per-round verification + gate results (audit trail)
alter table articles add column triage_reason text;
alter table articles add column is_roundup boolean;

alter table funding_rounds add column stage_basis text check (stage_basis in ('stated', 'inferred_from_amount', 'undisclosed'));
alter table funding_rounds add column age_hours_at_discovery numeric;

create index articles_new_idx on articles (id) where status in ('new', 'candidate');
