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
