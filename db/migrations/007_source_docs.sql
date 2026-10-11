-- 007 — keep the exact texts each assessment was based on, so a thesis change can be re-scored
-- against the same evidence without re-fetching the web (reproducible, cheaper).
alter table funding_rounds add column source_docs jsonb;
