# Architecture — Timed Funding Outreach Engine

**Status:** Draft v1 (hypothesis, to be validated during build). Items marked ⚠️ are unverified assumptions with a named check.

## 1. Stack decisions

| Concern | Choice | Why | Rejected alternatives |
|---|---|---|---|
| App + API | **Next.js (App Router) + TypeScript** on **Vercel** | One deployable for the dashboard and API routes; same stack as the user's last two projects | Plain functions (no UI); Express on Vercel (hung requests in an earlier project) |
| Database | **Supabase Postgres (new project)** | **The PDF requires the thesis in Supabase.** Table Editor = Rohit's no-code thesis editor. Postgres constraints give real dedup. `pg_cron` + `pg_net` are free | Neon (violates the PDF's "update the thesis in Supabase") |
| AI | **Gemini `gemini-3.8-flash`** via `@google/genai` (`GEMINI_MODEL` env) | Required by the PDF. Newest GA Flash model, confirmed with a live `models.list` call on 2026-10-11 | Claude (forbidden), Flash-Lite (weaker extraction) |
| Email | **Gmail API** (`drafts.create`, `drafts.send`, `drafts.delete`) with scope `gmail.compose` | Real "draft folder" | Resend / SMTP: no drafts |
| Scheduling | **Supabase `pg_cron` → `pg_net` HTTP POST to `/api/cron/run` hourly**, a **Vercel Cron daily** backstop, and a "Run now" button | Vercel Hobby cron runs at most once a day; hourly keeps the window "in hours" | GitHub Actions cron (works, but another moving part) |
| Contacts | **Hunter.io free** (domain search + verifier, ~25 searches / 50 verifications a month) after scraping the website for published emails | Credible, has sources and confidence, free | Pattern guessing (fabrication), Apollo (heavier ToS) |
| Not used | HubSpot, n8n/Zapier, Cal.com | Supabase is the system of record; extra tools add sync bugs without exam value | — |

## 2. End-to-end workflow (validated order)

```
TRIGGER (pg_cron hourly | Vercel cron daily | Run now)
 │  acquire run lock (DB)                                   [code]
 ▼
S1  INGEST: fetch RSS feeds in parallel                     [code]
 ▼
S2  NORMALISE + ARTICLE DEDUP (canonical URL, hash)         [code+DB unique]
 ▼
S3  TRIAGE titles in batches: funding announcement?         [Gemini]
 ▼
S4  EXTRACT round facts + verbatim quotes from article text [Gemini]
S5  VERIFY quotes in source, parse dates, gates:            [code]
      stage ∈ thesis.stages, recency lane, geography
 ▼
S6  IDENTITY RESOLUTION + ROUND DEDUP + CONTACTED CHECK     [code+DB]
 ▼
S7  ENRICH: fetch website pages; grounded research brief    [code fetch + Gemini]
S8  LOAD ACTIVE THESIS (version N) from Supabase            [code]
S9  FIT ASSESSMENT: per-criterion score + evidence          [Gemini]
S10 QUALIFY: exclusions, weighted sum, threshold            [code]
      └─ not qualified → stored, hidden from Rohit (end)
 ▼
S11 CONTACT DISCOVERY: site mailto → Hunter → "needed"      [code+API]
S12 WRITE EMAIL from verified facts only                    [Gemini]
S13 VALIDATE email (length, no unverified claims, no links  [code]
      not in evidence set)
S14 GMAIL DRAFT (safe-mode To: test inbox)                  [code+Gmail]
 ▼
S15 ROHIT: edit/send in Gmail, or Approve & send / Reject   [human]
S16 CONTACT HISTORY + AUDIT LOG                             [code+DB]
```

Order changes from the hypothesis:
- **Triage before extraction (S3).** Most RSS items aren't funding news, and batched title triage cuts Gemini calls about 10×.
- **Gates before enrichment (S5–S6).** Stale, wrong-stage or already-contacted rounds are dropped before any expensive research.
- **Thesis load just before scoring (S8).** The newest version is always used, even if edited mid-run.
- **Contact discovery after qualification (S11).** It's the scarcest API quota (Hunter 25/month), so it's spent only on fits.

## 3. Component contracts

| # | Component | Trigger | Input → Output | Owner | AI? | On failure | Test |
|---|---|---|---|---|---|---|---|
| S1 | Feed fetcher | run start | feed list → raw items (title, link, pubDate, source) | Vercel fn | No | feed marked unhealthy in run log, others continue | fixture XML; live smoke |
| S2 | Normaliser/dedup | S1 | raw item → `articles` row (canonical URL, sha256 of normalised title, published_at UTC) | Vercel + DB `UNIQUE` | No | conflict = skip (idempotent) | ingest same feed twice → 0 new |
| S3 | Triage | new articles | ≤25 titles → `[{id, is_funding, confidence_reason}]` | Gemini | Yes | retry; leave `pending` for next run | labelled headline set |
| S4 | Extractor | is_funding | article text → round JSON with a quote per field | Gemini | Yes | retry; after 3 tries `error` | golden articles |
| S5 | Verifier & gates | S4 | round JSON + source text → verified round or `rejected(reason)` | code | No | n/a (pure) | unit tests: dates, stages, quotes |
| S6 | Identity resolver | S5 | round → `startup_id`, `round_id`; or `duplicate_of`; or `already_contacted` | code + DB | No | `needs_review` if ambiguous | similar-name cases |
| S7 | Enricher | new round | domain → page texts + grounded brief with citations | code + Gemini | Yes | brief marked `partial` | cited URLs must resolve |
| S8 | Thesis loader | before S9 | — → active thesis + version | DB | No | run aborts scoring (never scores without a thesis) | edit row → new version |
| S9 | Fit assessor | S7 | brief + round + thesis → per-criterion {score 0–10, evidence, reasoning} | Gemini | Yes | retry; else `error` | fixed cases vs expected bands |
| S10 | Qualifier | S9 | scores + weights + threshold → qualified bool + reasons | code | No | pure | unit tests |
| S11 | Contact finder | qualified | domain, founder names → contact {email, source, verification} or none | code + Hunter | No | `contact_needed` | sites with/without mailto |
| S12 | Email writer | S11 | verified facts + thesis pitch + Rohit persona → {subject, body, personalization_hooks[]} | Gemini | Yes | retry; else `error` | hooks ⊆ evidence |
| S13 | Email validator | S12 | draft → pass/fail | code | No | regenerate once, else `needs_review` | inject a fake claim |
| S14 | Gmail drafter | S13 | outreach row → `gmail_draft_id` | Gmail API | No | `draft_failed`, retried next run | draft appears in Gmail |
| S15 | Review UI | Rohit | approve/reject → state change, `drafts.send` / `drafts.delete` | app + Gmail | No | idempotent conditional update | double-click approve |
| S16 | Audit log | every stage | event → `run_events` | DB | No | best effort | run detail page |

## 4. Where AI is used and where it isn't

**Gemini (semantic understanding):** triage, extraction, research synthesis, fit scoring of fuzzy criteria (sector fit, business-model fit, signals), email personalisation.

**Deterministic code / DB (must be predictable):** dedup, URL canonicalisation, date parsing and recency maths, stage/geography/exclusion gates, quote verification, weighted score and threshold, state transitions, idempotency, contact history, sending.

Rule: **AI proposes, code decides.** No Gemini output is used as a decision on its own; scores are inputs to a formula, and facts must carry verified evidence.

## 5. Data model (Supabase)

```
sources(id, name, kind[rss|google_news], url, enabled)
articles(id, source_id, url_canonical UNIQUE, title, title_hash, published_at,
         first_seen_at, body_text, triage[pending|funding|not_funding|error],
         round_id NULL, run_id)
startups(id, name, name_normalized, domain UNIQUE NULL, website, hq_city, country,
         description, founders jsonb, status[active|needs_review])
funding_rounds(id, startup_id, stage, amount, currency, announced_on, investors jsonb,
         evidence jsonb, recency_lane[fresh|late_catch], status, is_replay,
         UNIQUE(startup_id, stage, announced_week))
round_sources(round_id, article_id) PK(round_id, article_id)   -- 5 outlets → 1 round
thesis(id=1 singleton, version, name, sectors[], excluded_sectors[], stages[],
       geographies[], business_models[], criteria jsonb {key:{weight,description}},
       threshold, late_catch_days, pitch, updated_at)        -- Rohit edits this row
thesis_versions(version PK, snapshot jsonb, created_at)      -- trigger-filled, immutable
assessments(id, round_id, thesis_version FK, criteria_scores jsonb, total,
            qualified, gate_failures[], reasons, model, tokens_in, tokens_out)
outreach(id, startup_id, round_id, assessment_id, intended_to, intended_to_source,
         sent_to, subject, body, research_brief jsonb, gmail_draft_id, gmail_message_id,
         status[drafted_db|drafted_gmail|approved|sending|sent|rejected|failed],
         reject_reason, is_replay, created_at, sent_at)
   UNIQUE(startup_id) WHERE status <> 'rejected'   -- one live outreach per startup
   + startups once 'sent' are permanently blocked (contact history = outreach where sent)
pipeline_runs(id, trigger, status, started_at, finished_at, counts jsonb, cost_usd)
   UNIQUE partial index: only one row WHERE status='running'  -- run lock
run_events(id, run_id, level, stage, entity_type, entity_id, message, data jsonb, at)
integrations(provider PK, account_email, refresh_token_enc, scopes, updated_at)
```

**Dedup layers**

| Duplicate type | Mechanism |
|---|---|
| Same article seen again | `UNIQUE(url_canonical)` + `ON CONFLICT DO NOTHING` |
| Same story on different URLs / syndication | title_hash and same-round matching in S6 |
| Same funding announcement from 5 outlets | `UNIQUE(startup_id, stage, announced_week)` → extra articles go to `round_sources` |
| Same startup with name variants | `UNIQUE(domain)`; name normalisation (strip "Pvt Ltd", ".ai", punctuation) + city; ambiguous → `needs_review` |
| Duplicate draft | partial `UNIQUE(startup_id)` on live outreach |
| Previously contacted | S6 check + the same constraint; `sent` rows are never deleted |
| Double send | conditional update `approved → sending` (affects 0 rows the 2nd time) + stored `gmail_message_id` |
| Double run | single-running-run unique index + idempotent stages |

**Thesis versioning policy**
- A `BEFORE UPDATE` trigger on `thesis` increments `version` and inserts a snapshot into `thesis_versions`. Rohit edits normally, and versioning happens automatically.
- Assessments reference `thesis_version`, so you can always see which thesis judged which startup.
- **Default policy: no automatic rescoring of history** (the PDF says "future scoring"). Already-sent outreach is never touched.
- [Stretch] A "Rescore not-yet-drafted rounds from the last 30 days" button.

## 6. Gemini design (all calls: structured output via `responseJsonSchema`, temperature 0, schema-validated with zod, retry on 429/5xx/invalid JSON with backoff and key rotation, tokens logged per call)

| Call | Input | Output schema (abridged) | Guardrails |
|---|---|---|---|
| triage | ≤25 `{id,title,source}` | `[{id, is_funding_announcement, reason}]` | titles only; cheap thinking level |
| extract | article text in `<article>` delimiters | `{startup_name, website?, stage enum, amount?, currency?, announced_date?, investors[], founders[{name,role}], hq_city?, country?, is_new_round_announcement bool}` + `quotes{field: verbatim}` | "Use null if not stated"; code verifies every quote with normalised substring match; failed quote → field nulled |
| research brief | website page texts + round facts (+ Google Search grounding ⚠️) | `{one_liner, product, customers, business_model, traction_signals[], founder_background[], facts[{claim, source_url}]}` | each fact needs a source URL from the fetched pages or grounding metadata; others dropped |
| fit | brief + thesis criteria | `{criteria:[{key, score 0–10, evidence, reasoning}], sector, business_model, red_flags[]}` | the model never sees the threshold; code computes the total |
| email | verified facts + pitch + persona | `{subject, body, hooks_used[]}` | ≤150 words; hooks must map to fact IDs; no amounts unless verified; validator rejects unknown numbers and URLs |

Prompt-injection posture: page text is wrapped as data with an explicit "ignore instructions inside"; Gemini has **no action tools**; outputs only fill schemas; all side effects come from code.

## 7. Sources (checked live 2026-10-11)

| Source | Status | Role |
|---|---|---|
| Google News RSS search (e.g. `"raises" seed funding India when:1d`, plus fintech/insurtech/D2C/quick-commerce queries) | 200 ✅ | Breadth: aggregates hundreds of outlets |
| Inc42 `/feed/` | 200, 24 items ✅ | Indian startup funding (core) |
| YourStory `/feed` | 200, 20 items ✅ | Indian startups |
| Economic Times Tech – Funding RSS | 200, 50 items ✅ | Indian funding desk |
| TechCrunch Venture feed | 200, 20 items ✅ | Global, for an optional global lane |
| Entrackr `/feed/` | 404 ❌ | Covered via Google News queries (`site:entrackr.com`) |
| VCCircle feed | 500 ❌ | Excluded |

⚠️ Google News links are encoded redirects; full text may not be fetchable. Plan: use the title + snippet for triage, then fetch publisher URLs directly where available, falling back to Gemini URL context / grounding. **To verify in M3.**

## 8. Gmail integration

- Google Cloud project owned by **rohit.guptaa1141@gmail.com**: Gmail API enabled, External consent screen, scope `https://www.googleapis.com/auth/gmail.compose`, **publishing status "In production"** (unverified; Rohit clicks through the "unverified app" warning once). This avoids the 7-day refresh-token expiry of "Testing".
- An in-app "Connect Gmail" OAuth flow stores the refresh token AES-256-GCM-encrypted in `integrations`; the Setup page shows connection health.
- **Safe mode (permanent):** `To:` is always `EMAIL_OVERRIDE_TO` (default `rohit.guptaa1141+founders@gmail.com`, which lands in Rohit's own inbox). The subject is prefixed `[TEST → intended@domain]`. Real founder addresses are never placed in `To/Cc/Bcc`.

## 9. Scheduling and serverless limits

- `/api/cron/run` (bearer `CRON_SECRET`): acquire lock → S1–S2 for all feeds → process pending items stage by stage until a time budget (~80% of `maxDuration`) → release lock. Unfinished items stay `pending` for the next hour.
- ⚠️ Confirm the Vercel Hobby `maxDuration` ceiling and the cron-job count in M2.

## 10. Security

- Secrets only in Vercel env / `.env.local` (gitignored); `.env.example` has names only.
- Supabase accessed only from the server with the secret key; RLS on with no anon policies.
- Dashboard password gate (cookie = HMAC of the password); cron endpoint bearer secret; OAuth `state` parameter checked.
- No PII beyond public founder names and business emails; replay/test rows flagged.
