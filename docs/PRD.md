# PRD — Timed Funding Outreach Engine

**Status:** Draft v1 for approval · **Owner:** Raghav Gombar · **Date:** 2026-10-11
**Source of truth:** `Problem Statement 6-2.pdf` (Mesa C4 Final, PS6, High Difficulty)

> Legend: **[PDF]** = explicit requirement · **[Implied]** = needed to make the PDF work · **[Enh]** = our proposed enhancement · **[Stretch]** = only if time allows.

---

## 1. Problem statement

Rohit recruits startups for an early-stage accelerator. Founders who have just raised a seed or pre-seed round are the best prospects: they have new capital and are actively deciding what they need next. Outreach 30–60 days after a raise converts far better than a cold email six months later.

Today Rohit watches 3–4 news sources by hand, bookmarks funding announcements and tracks them in a spreadsheet. He estimates he **misses 30–40% of relevant announcements**. Each startup he does find costs another **~20 minutes** of research, fit assessment and drafting.

**He wants:** each morning, a ready-to-send personalised draft in his email draft folder for every startup that announced a round in the past 24 hours *and* fits the thesis. Startups that don't fit never reach him. Nobody is contacted twice. He can change the thesis in Supabase without code changes. **[PDF]**

## 2. Target user

| | |
|---|---|
| Primary | **Rohit Gupta**, Program Recruitment Lead at **Tandem Forge Accelerator** (fictional), an India-focused pre-seed/seed accelerator for fintech, insurtech and consumer/D2C commerce |
| Context | Non-technical operator. Lives in Gmail. Comfortable editing a table row in Supabase. |
| Secondary | Accelerator partners, who change the thesis; the examiner, who audits decisions |

## 3. Jobs to Be Done

- **Functional:** "When a relevant startup announces a seed or pre-seed round, get a researched, personalised email in front of me within hours, so I reach the founder while they're deciding."
- **Emotional:** "I want to trust that I'm not missing deals and that I'll never embarrass us with a wrong, generic or duplicate email."
- **Operational:** "Give me one record of what we found, why it fits and who we've contacted, and let me change our criteria myself."

## 4. Desired business outcome

Move Rohit from **reactive, partial coverage** (manual, ~60–70% recall, 20 min per startup, days of delay) to **systematic, same-day coverage** (multi-source, hours from announcement to draft, ~2–3 min of human review per startup). He spends his time on judgement and relationships, not on searching and typing.

## 5. Core user journey

1. **Hourly, unattended:** the engine pulls funding news from several live sources.
2. It keeps only real, new seed/pre-seed rounds announced inside the recency window and deduplicates them.
3. It researches each startup, scores it against the **current** thesis from Supabase, and silently drops non-fits.
4. For each fit it finds a contact, writes a personalised email and **creates a draft in Rohit's Gmail**.
5. **9:00 am:** Rohit opens Gmail or the dashboard. Each draft has a short "why this startup" brief and source links in the app.
6. Rohit edits and sends from Gmail, or clicks **Approve & send** or **Reject (reason)** in the app.
7. The contact history updates, so the startup can never be drafted or emailed again.
8. Whenever partners change focus, Rohit edits the thesis row in Supabase (or on the Thesis page). The next run scores with the new version.

## 6. Functional requirements

| ID | Requirement | Tag |
|---|---|---|
| F1 | Scheduled discovery from **multiple live sources** with source attribution and publication timestamps | PDF / Implied |
| F2 | Manual "Run now" trigger, protected by the dashboard login | Enh |
| F3 | Normalise articles; reject duplicates by canonical URL and content hash | Implied |
| F4 | Gemini classifies each item as a funding announcement or not, and extracts startup, stage, amount, investors, announcement date, founders and website, **each with a supporting quote** | Implied |
| F5 | Code verifies that each quote exists in the source text; unsupported fields are set to null | Implied |
| F6 | **Recency:** primary lane = announced ≤ 24h before discovery; "late catch" lane = announced ≤ `late_catch_days` (default 30) ago and first seen now; older rounds are discarded | PDF + Enh |
| F7 | Startup identity resolution (domain first, then normalised name + city); merges the same round reported by several outlets into one round with many sources | Implied |
| F8 | Load the **active thesis from Supabase at scoring time**; every assessment stores `thesis_version` | PDF |
| F9 | Hard gates in code (stage, geography, exclusions, recency, already contacted); Gemini scores semantic criteria with evidence; code computes the weighted score and applies the threshold | PDF / Implied |
| F10 | Non-qualified startups never appear in Rohit's queues or Gmail; they're visible only in a collapsed "Filtered out" audit view | PDF + Enh |
| F11 | Evidence-backed research brief for qualified startups (Gemini, grounded on fetched pages and Google Search citations) | PDF ("researched") |
| F12 | Contact discovery: emails published on the startup's website, then Hunter.io domain search and verification, then "contact needed". **Email addresses are never guessed.** | Implied |
| F13 | Gemini writes a personalised email using **only verified facts** | PDF |
| F14 | **Draft created in Rohit's real Gmail Drafts folder** via the Gmail API | PDF |
| F15 | **Safe mode (always on for this project):** every draft is addressed to the test inbox; the intended founder address is shown in the subject tag and the app only | Enh (user decision) |
| F16 | Approve & send / Reject with reason from the app; Rohit can also send directly from Gmail and a sync detects it | Enh / Stretch |
| F17 | **No duplicate outreach**: DB-enforced one active outreach per startup, a permanent contact history, and idempotent send | PDF |
| F18 | Thesis editable in Supabase Table Editor **and** on an in-app Thesis page; every edit creates a new version snapshot | PDF + Enh |
| F19 | Pipeline run history with per-stage counts, errors and Gemini token cost | Enh |
| F20 | Honest empty states. A separately labelled **Replay** mode re-runs the pipeline on real historical announcements, tagged `REPLAY` everywhere | Enh |

## 7. Non-functional requirements

- **AI provider:** Gemini Flash only (`gemini-3.8-flash`, model ID kept in an env var). No Claude or other LLM, not even as a fallback. **[PDF]**
- **Hosting:** Vercel (Next.js) + Supabase Postgres + GitHub. **[PDF]**
- **Reliability:** each item progresses through persisted states, so a crash mid-run loses nothing and the next run resumes. Re-running is a no-op (idempotent).
- **Security:** secrets only in env vars; the Gmail refresh token is encrypted at rest; cron endpoint protected by a bearer secret; dashboard behind a password; Supabase RLS on with no public anon access.
- **Truthfulness:** no invented funding events, founders, emails, amounts or URLs. Missing data = `unavailable`. Verified facts are labelled separately from AI inference.
- **Prompt-injection safety:** article and web text is treated as data inside delimited blocks; Gemini has no tools that can act, and all actions are taken by code.
- **Cost:** free tiers only. Gemini spend per run is tracked.
- **Latency:** announcement → draft ≤ ~2h for items picked up by the hourly run (target, not yet measured).

## 8. User stories and acceptance criteria

| # | Story | Acceptance criteria (testable) |
|---|---|---|
| US1 | As Rohit, I want funding news collected automatically so I stop missing announcements. | Runs hourly without manual action; each article stores source, URL and published_at; the same URL ingested twice → 1 row. |
| US2 | As Rohit, I only want fresh rounds. | A round announced 3 days ago with `late_catch_days=0` → discarded with reason `stale`; one announced 10h ago → proceeds. Unit-tested date logic incl. timezones. |
| US3 | As Rohit, I never want to see non-fits. | A startup scoring below threshold or hitting an exclusion has no draft and does not appear in Inbox/Drafts views. |
| US4 | As Rohit, I want to change the thesis without engineers. | Edit `threshold` or `sectors` in the Supabase Table Editor → the next assessment records the new `thesis_version` and the decision changes accordingly. |
| US5 | As Rohit, I want a ready draft in Gmail. | A qualified startup produces a Gmail draft visible in the Drafts folder of rohit.guptaa1141@gmail.com; `gmail_draft_id` is stored. |
| US6 | As Rohit, I never want to email a founder twice. | Same startup from 5 articles → 1 draft. A second Approve click → no second email (state check plus DB constraint). A startup already `sent` re-appearing in news → no new draft. |
| US7 | As Rohit, I want to trust every claim. | Every fact in the brief links to a source URL; quotes not found in the source are dropped; emails reference only verified fields. |
| US8 | As Rohit, I want to reject bad drafts. | Reject → Gmail draft deleted, status `rejected`, reason stored, the startup is not redrafted. |
| US9 | As an examiner, I want to see the system working live. | The public Vercel URL shows real ingested articles with timestamps and the latest run; an empty window shows an honest empty state; replay data is visibly tagged. |

## 9. Risks and dependencies

| Risk | Impact | Mitigation |
|---|---|---|
| Gmail OAuth (unverified app, restricted `gmail.compose` scope; "Testing" status refresh tokens expire after 7 days) | Drafts stop silently | Publish the consent screen "In production" (unverified, single user); show token health on a Setup page; alert in the run log |
| No qualifying rounds in a 24h window on demo day | Empty demo | Hourly runs build a backlog over the days before the exam; late-catch lane; labelled Replay |
| Extraction errors (old round, wrong stage, wrong company) | Wrong outreach | Quote verification, deterministic gates, ambiguity → `needs_review`, test set of real headlines |
| Founder emails unavailable | Draft without a recipient | "Contact needed" flag; never guess |
| Gemini rate limits / quota | Partial run | Title triage batching, key rotation, backoff, resumable states |
| Vercel Hobby limits (cron once a day, function duration) | Long runs cut off | Supabase `pg_cron` hourly trigger; time-budgeted batches; resumable states |
| Source feeds change or block | Coverage drop | Several independent feeds; per-source health in the run log |

**Dependencies:** Gemini API, Supabase, Vercel, Google Cloud project (Gmail API), Hunter.io free tier, publisher RSS feeds, Google News RSS.

## 10. MVP vs enhancements

| MVP (must ship) | Enhancements (planned) | Stretch |
|---|---|---|
| F1, F3–F15, F17, F18 (Supabase), F19 basic, F20 empty state | In-app Approve & send / Reject, Thesis page, cost tracking, Filtered-out audit view, Replay mode | Gmail sent-sync, rescore pending on thesis change, morning digest email, day-7 follow-up |

## 11. Success metrics (all **targets**; measured values go in the Test Report, never here)

| Metric | Definition | Target |
|---|---|---|
| Discovery coverage | Share of a manually compiled list of 24h Indian seed/pre-seed announcements (Inc42/Entrackr/ET) that the engine captured | ≥ 85% |
| Discovery → draft time | median(draft_created_at − article first_seen_at) | ≤ 2 h |
| Qualification precision | Share of drafted startups a human judges as fitting the thesis | ≥ 80% |
| Hard-gate accuracy | Stage, recency and geography gates correct on the labelled test set | 100% |
| Major-edit rate | Drafts Rohit edits beyond light tweaks (self-reported tag on approve) | ≤ 30% |
| Duplicate outreach rate | Startups with > 1 sent email | **0 (DB-enforced)** |
| Automation success rate | Successful scheduled runs / scheduled runs | ≥ 95% |
| Time saved | (20 min − review min) × qualified startups per week | Reported from logs |

## 12. Out of scope

- Sending to real founders (safe mode is permanent for this project).
- Paid funding databases (Crunchbase/Tracxn APIs).
- CRM sync (HubSpot): Supabase is the system of record.
- Multi-user roles.
