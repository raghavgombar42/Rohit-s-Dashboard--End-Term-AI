# Tandem Forge — Timed Funding Outreach Engine

Finds Indian startups that just announced a pre-seed/seed round, scores them against an accelerator thesis stored in Supabase, researches them, and puts a personalised outreach draft in Rohit's Gmail Drafts folder. Built for the Mesa C4 "AI and its Applications" final (Problem Statement 6).

- **Stack:** Next.js 16 (Vercel) · Supabase Postgres · Gemini Flash (`gemini-3.8-flash`) · Gmail API
- **Docs:** [PRD](docs/PRD.md) · [Architecture](docs/ARCHITECTURE.md) · [Decisions](docs/DECISIONS.md)

## Local setup
```bash
npm install
cp .env.example .env.local   # fill in values
npm run db:migrate
npm run dev
```

Safe mode is always on: drafts are addressed to `EMAIL_OVERRIDE_TO`, never to founders.
