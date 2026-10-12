@AGENTS.md

# Project notes (Timed Funding Outreach Engine — Mesa C4 Final, PS6)
- Source of truth: ../Problem Statement 6-2.pdf. Design docs: docs/PRD.md, docs/ARCHITECTURE.md, docs/DECISIONS.md.
- All AI = Gemini Flash (GEMINI_MODEL=google/gemini-3.8-flash) via the course OpenRouter key (OPENROUTER_API_KEY), Google-only provider routing, no fallbacks. Never add Claude/other LLM calls or call Google AI Studio directly.
- AI proposes, code decides: dedup, dates, gates, thresholds, state transitions live in code + DB constraints.
- Safe mode is permanent: emails only ever go to EMAIL_OVERRIDE_TO, never to founders.
- Never invent funding events, founders, emails or URLs; missing = null/unavailable.
- Migrations: db/migrations/*.sql via `npm run db:migrate`. DB guarantees: `npx tsx --env-file=.env.local tests/db-guarantees.check.mts`.
- cacheComponents is OFF; dashboard pages use force-dynamic.
