# Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-10-11 | Supabase (new project, Mumbai), not Neon | PDF requires the thesis to be editable in Supabase |
| 2026-10-11 | Gemini `gemini-3.8-flash` | Newest GA Flash model listed by `models.list` on our key |
| 2026-10-11 | Gmail API drafts (`gmail.compose`), OAuth app "In production" | PDF says "draft folder"; Testing-mode tokens expire in 7 days |
| 2026-10-11 | Safe mode permanent: all mail to EMAIL_OVERRIDE_TO | Assignment; real founders must never be emailed |
| 2026-10-11 | India · fintech, insurtech, D2C tech/brands, quick commerce; exclude B2B SaaS, AI, climate | User's interest; editable in thesis |
| 2026-10-11 | 24h fresh lane + 30-day late-catch lane | Honours the PDF's 24h promise while recovering missed rounds inside the 30–60 day window |
| 2026-10-11 | Hourly trigger via Supabase pg_cron → /api/cron/run; Vercel cron daily backstop | Vercel Hobby cron is at most once per day |
| 2026-10-12 | Direct Postgres (postgres.js) instead of supabase-js | Transactions, ON CONFLICT and conditional updates for idempotency |
| 2026-10-12 | Next.js 16.4 with cacheComponents off | Live operational dashboard; simpler, predictable per-request rendering |
| 2026-10-12 | Thesis versioning by DB triggers (validate → bump → snapshot; delete blocked) | Edits in the Table Editor are versioned with no app involvement |
| 2026-10-12 | No login page: dashboard is public & read-only; side-effecting actions need "operator mode" (passcode → HMAC cookie) | PDF asks for a working public URL; examiner must see everything, but strangers must not trigger runs/sends |
| 2026-10-12 | Google News items used for coverage (headline, publisher, time) — links are JS redirects and not resolvable server-side; added direct feeds (Entrackr /rss, Inc42 Buzz full text) | Avoid relying on Google's undocumented decoding endpoint |
| 2026-10-12 | Disabled Business Standard (HTTP 403 to servers) and ET Startups (stale, all items > 31 days) | Observed on first live run; kept in table for audit |
| 2026-10-12 | Ingest cutoff = max(late_catch_days, fresh window) + 1 day by article date | An older article cannot announce a round we would still act on |
| 2026-10-12 | Syndicated copies (same normalised headline, different URL, 14 days) stored but marked duplicate_of:<id>, never sent to AI | Cost and dedup; kept as extra sources |
| 2026-10-12 | Pipeline: 240s work budget inside Vercel Hobby's 300s max; stale run lock auto-released after 10 min | Vercel Hobby duration limit (docs checked 2026-10-12) |
| 2026-10-12 | Gemini schemas generated from zod (`z.toJSONSchema`) and re-validated with zod; no `maxItems` on object arrays | Single source of truth for schemas; Gemini returns HTTP 400 on maxItems over object arrays (found in testing) |
| 2026-10-12 | Roundup articles allowed: extraction returns a list of rounds per article | Weekly roundups (Entrackr, Inc42) carry many small seed rounds — high recall value |
| 2026-10-12 | Quote verification: each fact must have a verbatim quote found in the source; else field nulled (stage → undisclosed; startup → round dropped) | Hallucination control done by code, not by trusting the model |
| 2026-10-12 | Unlabelled rounds ≤ US$4M (INR at fixed 88/USD) are treated as seed, recorded as `inferred_from_amount` | Indian press often omits the stage for small rounds; deterministic, visible, editable rule |
| 2026-10-12 | Stated date without time = end of that day IST; no stated date → article publish time | Most generous honest reading; documented on every round |
| 2026-10-12 | Country may be inferred (city / context); INR-denominated round with no country → India (`inferred_from_currency`) | First live run wrongly rejected Zomint & KILRR as geography_unknown |
| 2026-10-12 | Startup identity: domain first, then normalised name; conflicting matches → needs_review, never auto-merged. Round dedup: same startup + stage within ±21 days | Avoid both duplicates and wrong merges |
| 2026-10-12 | Website discovery: use the article URL if verified; else Gemini + Google Search proposes ≤3 URLs; code accepts one only if it loads and the startup name is on the page/domain | Grounding returned no citation metadata, so AI output is treated as a proposal and verified deterministically |
| 2026-10-12 | Research brief built only from sources we fetched (funding articles + company site pages); each fact needs a source id + near-verbatim quote | Evidence-backed research; no model memory |
| 2026-10-12 | Fit: Gemini (thinking MEDIUM) scores each thesis criterion 0–10 with evidence; never sees weights or threshold. Code applies evidence-or-zero, weights, exclusions, threshold | AI proposes, code decides; reproducible maths |
| 2026-10-12 | Evidence matching for fit/research is near-verbatim (≥90% of words in order within one passage); extraction facts stay exact-match | Observed Gemini trimming 2 words from real quotes (Lorazzo 75.5→56.5 flip); invented sentences still fail |
| 2026-10-12 | Rescore policy: on thesis change, rounds assessed but not drafted are rescored automatically on the next run. Numbers-only edits (threshold/weights) are re-applied by code to existing verified scores with no AI call; wording/sector edits re-ask Gemini. Drafted/contacted rounds are never rescored | PDF: future scoring reflects the thesis; avoid AI noise & cost; never rewrite outreach history |
| 2026-10-12 | Source texts used for an assessment are stored (funding_rounds.source_docs) | Reproducible rescoring against identical evidence |
| 2026-10-12 | Non-qualified startups are hidden from Rohit's views (Qualified, Funding rounds) and shown only in the audit tab | PDF: "If a startup does not fit, he should never see it" |
| 2026-10-12 | UI palette: indigo→violet gradient header, colour-coded stats and funnel | User feedback: previous palette too dull |
