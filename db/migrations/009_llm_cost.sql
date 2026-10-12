-- 009 — AI now goes through OpenRouter (course-issued key), which reports the real cost of each call.
alter table llm_calls add column cost_usd numeric;
