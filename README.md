# Tandem Forge — Timed Funding Outreach Engine

**Mesa C4 · AI and its Applications · Final · Problem Statement 6 (Hard)**

Rohit recruits founders for an early-stage accelerator. The best moment to reach a founder is right after they raise a pre-seed or seed round. Today Rohit does this by hand: he checks a few news sites, misses 30–40% of announcements, and spends about 20 minutes researching and writing each email.

This engine does that work every hour. It reads live Indian funding news and keeps only **new pre-seed/seed rounds that fit the accelerator's thesis**. The thesis is stored in Supabase and Rohit edits it himself. For each startup that fits, the engine researches it from real sources and leaves a **personalised email in Rohit's Gmail Drafts folder**. Startups that don't fit never reach him. No startup is ever contacted twice.

| | |
|---|---|
| **Live app** | https://tandem-forge-outreach.vercel.app |
| **Components Map** | https://tandem-forge-outreach.vercel.app/components-map.html |
| **Repository** | https://github.com/raghavgombar42/Rohit-s-Dashboard--End-Term-AI |
| **Stack** | Next.js 16 (Vercel, Mumbai) · Supabase Postgres · Gemini `gemini-3.8-flash` · Gmail API · Hunter.io |

> **Safe mode is permanent.** Every email is addressed to a test inbox (`EMAIL_OVERRIDE_TO`). Real founders are never emailed. Each draft's subject shows the founder address it *would* go to.

---

## How it works

| # | Step | Who | What happens |
|---|---|---|---|
| 1 | Trigger | Supabase `pg_cron` hourly → `/api/cron/run`; Vercel Cron daily; **Run now** | A bearer secret is kept in Supabase Vault. A DB run lock means only one run at a time. The 240 s work budget is resumable. |
| 2 | Discover | code | 9 live RSS feeds: Inc42, Inc42 Buzz, Entrackr, YourStory, ET Tech Funding, TechCrunch Venture, and 3 Google News searches. |
| 3 | Dedup | code + DB | The same URL is stored once (unique index). A syndicated headline is kept as a source but never sent to the AI again. |
| 4 | Triage | **Gemini** | Classifies 25 headlines per call: is this new money raised by a private startup? |
| 5 | Extract | **Gemini** | Extracts every round in the article (startup, stage, amount, date, investors, founders), each with a **verbatim quote**. |
| 6 | Verify & gate | code | Quotes must appear in the source, otherwise the fact is dropped. Hard gates: pre-seed/seed/angel · India · a new announcement · ≤ 24 h (fresh) or ≤ 30 days (late catch). |
| 7 | Identity | code + DB | A startup is matched by domain, then by name. The same startup and stage within 21 days counts as one round. Startups already contacted are skipped. |
| 8 | Research | **Gemini** + code | Gemini + Google Search *proposes* a website. Code only accepts it if the page shows the startup's name. The brief is built only from fetched pages, and every fact cites a source and a quote. |
| 9 | Fit | **Gemini** + code | Gemini scores each thesis criterion 0–10 with evidence; it never sees the weights or the threshold. Code applies evidence-or-zero, weights, exclusions and the threshold. |
| 10 | Contact | code + Hunter.io | Uses an email published on the startup's own site, otherwise a Hunter.io founder match verified as deliverable. Addresses are **never guessed**. |
| 11 | Email | **Gemini** + code | Gemini writes from verified facts only. Code rejects unknown numbers, links, placeholders, the wrong length or a missing signature, then allows one rewrite. |
| 12 | Gmail | Gmail API | The draft is created in Rohit's Drafts (`gmail.compose` scope; refresh token AES-256-GCM encrypted). |
| 13 | Review | **Rohit** | Approve & send (a double click still sends once) or Reject (the Gmail draft is deleted). A draft he sends or deletes in Gmail is detected on the next run. |

**AI proposes, code decides.** Gemini reads, extracts, researches, scores and writes. Everything that must be predictable is code or a database constraint: dedup, dates, gates, quote checks, weighted maths, state transitions, one-outreach-per-startup and send-once.

## The thesis is editable in Supabase (no code change)

Rohit edits table **`thesis`** (row `id = 1`) in the Supabase Table Editor. It holds the sectors, excluded sectors, stages, geographies, business models, criteria (`{key: {weight, description}}`), threshold, fresh window, late-catch days, pitch and signature.

- A database trigger **validates** each edit (bad JSON or weights are refused), **bumps the version** and **snapshots** it into `thesis_versions`.
- Every assessment stores the `thesis_version` it used.
- On the next run, rounds that are scored but not yet drafted are **re-scored**:
  - If only numbers changed (threshold or weights), code re-applies the maths to the same verified scores, with no AI call.
  - If wording, sectors or exclusions changed, Gemini re-scores against the same stored evidence.
  - Rounds that already have outreach are never rescored.

Tested live: threshold 65 → 75 → 65 moved KILRR and Lorazzo out and back in, with versions v1 to v5 recorded.

## Data model (Supabase)

`sources` · `articles` · `startups` · `funding_rounds` · `round_sources` · `thesis` + `thesis_versions` · `assessments` · `outreach` · `pipeline_runs` · `run_events` · `llm_calls` · `integrations`. RLS is enabled on every table, and the browser never talks to Supabase directly.

| Duplicate type | Prevented by |
|---|---|
| Same article | `UNIQUE(url_canonical)` + `ON CONFLICT DO NOTHING` |
| Same story, other outlet | normalised headline hash → stored as a duplicate, skipped by AI |
| Same funding round | `UNIQUE(startup_id, stage, announced_week)` + ±21-day merge |
| Same startup | `UNIQUE(domain)`; a name clash with a different site → `needs_review`, never merged |
| Second outreach | partial `UNIQUE(startup_id) WHERE status <> 'rejected'`, plus any outreach row blocks drafting |
| Double send | conditional `UPDATE … WHERE status = 'drafted_gmail'` |
| Two runs at once | partial unique index on `pipeline_runs WHERE status = 'running'` |

## Pages

**Overview** · **Drafts** (approve/reject) · **Qualified** (research briefs + score breakdown) · **Discoveries** (every article) · **Funding rounds** (+ *Filtered out* audit) · **Pipeline runs** (event log per run) · **Thesis** · **Setup**.

The dashboard is public and read-only. Actions with side effects (Run now, Send, Reject, Connect Gmail) need **operator mode**, a passcode stored as an HMAC cookie. They are checked both in `proxy.ts` and in each handler.

## Run locally

```bash
npm install
cp .env.example .env.local      # fill in the values below
npm run db:migrate              # applies db/migrations/*.sql in order
npm run dev                     # http://localhost:3000
npm run pipeline                # one pipeline run from the CLI
```

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini Flash (comma-separated keys rotate on 429) |
| `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Supabase (pooler URI; transaction pooler `:6543` on Vercel) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Gmail OAuth (redirect `…/api/google/callback`) |
| `HUNTER_API_KEY` | optional founder-email lookup |
| `OPERATOR_PASSCODE`, `CRON_SECRET`, `TOKEN_ENCRYPTION_KEY` | operator mode, cron auth, token encryption (64 hex) |
| `EMAIL_OVERRIDE_TO` | safe-mode inbox: every draft goes here |

**Hourly schedule:** `npx tsx --env-file=.env.local scripts/set-cron-secret.ts` stores the cron secret in Supabase Vault. Migration `005` creates the `pg_cron` job.
**Deploy:** pushing to `main` auto-deploys on Vercel (project `tandem-forge-outreach`, region `bom1`).

## Tests

```bash
npm test                                                         # 39 unit tests
npx tsx --env-file=.env.local tests/db-guarantees.check.mts      # 10 DB-constraint checks (rolled back)
npx tsx --env-file=.env.local tests/run-lock.check.mts           # concurrent runs → one skipped
npx tsx --env-file=.env.local tests/gmail-e2e.check.mts          # live Gmail: drafts, send-once, reject, closed-in-Gmail, no duplicates
```

Unit tests cover:
- URL and headline normalisation
- quote verification, including near-verbatim matching
- stage, geography and recency gates, including the IST/UTC boundary
- evidence-or-zero scoring, weights, exclusions and the threshold
- thesis change detection
- website verification
- email validation
- contact ranking
- MIME encoding

The last test run passed 39/39 unit, 10/10 DB, 1/1 lock and 9/9 live Gmail checks.

## Known limitations

- **Google News links** are JavaScript redirects, so their article text can't be fetched. Those items use the headline, or the text of the same story from a direct feed.
- **Economic Times** blocks server fetches, so ET items use the feed snippet. Business Standard (403) and ET Startups (stale) are disabled.
- **Gemini scores vary between runs.** Across 12 startups scored twice, half moved ≤ 1.5 points and the largest move was 12 points (ReFit, which stayed "not qualified"). An earlier 19-point swing came from strict quote matching and was fixed with the near-verbatim check. Threshold-only thesis edits reuse the stored scores to avoid this noise.
- **Contacts:** without a published or Hunter-verified address, the draft says "no verified contact". Hunter's free tier is 50 searches a month.
- **"Sent from Gmail" vs "deleted in Gmail"** can't be told apart with the least-privilege `gmail.compose` scope. Both are recorded as `closed_in_gmail` and count as contacted.
- **The Gmail OAuth app is unverified** (personal use), so Google shows a warning on connect. Its status is set to "In production" so tokens don't expire after 7 days.
- **Vercel Hobby** allows a 300 s function limit and a once-a-day cron. That's why there's a 240 s budget, resumable stages and Supabase `pg_cron` for the hourly trigger.

Design notes: [docs/PRD.md](docs/PRD.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/DECISIONS.md](docs/DECISIONS.md)
