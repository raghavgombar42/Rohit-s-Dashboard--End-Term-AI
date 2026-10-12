# Components Map — exact content + ChatGPT prompt

Everything below describes the system **as built and live** (12 Oct 2026). Do not add components that aren't here.

---

## Prompt to paste into ChatGPT

> Create a **landscape A3 swimlane "Components Map" diagram** as a high-resolution image (and also export it as a one-page PDF), in the style of a clean consulting slide.
>
> **Layout**
> - Title at top: **"Timed Funding Outreach Engine — Components Map"**
> - Subtitle: **"Mesa C4 · AI Final · Problem Statement 6 (Hard) · as built and live, 12 Oct 2026"**
> - A grid with **8 actor rows** (labels on a dark navy/indigo left rail) and **6 stage columns** across the top, in this order: **Trigger · Input · Context · Processing · AI · Output** (dark header bar, small uppercase labels).
> - Put each numbered card in the cell (row × column) I specify. Alternate light row backgrounds. Use dashed arrows following the step numbers (0 → 19).
> - **Card colours (legend at top):** pink/magenta border = AI judgement (Gemini) · indigo/blue border = deterministic code · teal border = data, database & external APIs · orange border = a person acts. Lines starting with "✕" are "The Cut" and go in small red text at the bottom of the card.
> - Under the grid, three side-by-side note boxes: **"The Cut"** (red-tinted), **"AI proposes, code decides"** and **"Running cost"**.
> - Fonts: a modern sans-serif for body text, an elegant serif for the title. Keep every card's text exactly as given (you may shorten line breaks, but **do not change, add or invent wording, numbers or components**). Readable at 100% zoom.
>
> **Content:** (paste everything from "ROWS AND CARDS" to the end below)

---

## ROWS AND CARDS

**Row 1 — Rohit** (recruitment lead · Tandem Forge, a fictional accelerator)
- Trigger · *orange* · **0** — Optional "Run now" from the dashboard (operator mode).
- Context · *orange* · **T** — Edits the thesis row in the Supabase Table Editor (sectors, exclusions, criteria, weights, threshold). No code, no deploy.
- Output · *orange* · **17** — Reviews each draft in Gmail or the dashboard: edits, Approve & send, or Reject with a reason. ✕ nothing is ever sent without him

**Row 2 — Scheduler** (Supabase pg_cron · Vercel Cron)
- Trigger · *teal* · **1** — pg_cron fires hourly and calls the pipeline with a secret kept in Supabase Vault. Vercel Cron runs daily as a backup.

**Row 3 — Funding news** (9 live RSS feeds)
- Input · *teal* · **3** — Inc42, Inc42 Buzz, Entrackr, YourStory, ET Tech Funding, TechCrunch Venture + 3 Google News searches (seed India, fintech/insurtech, D2C/quick commerce). Headline, publisher, publish time.

**Row 4 — Pipeline** (Next.js 16 on Vercel, Mumbai)
- Trigger · *indigo* · **2** — Takes the run lock (one run at a time), 240-second work budget, resumable: unfinished items wait for the next hour.
- Input · *indigo* · **4** — Normalises URLs and headlines. Same URL → stored once; same headline from another outlet → kept as a source, never re-sent to AI.
- Processing · *indigo* · **7** — Checks every quote is really in the article (else the fact is dropped). Hard gates: pre-seed/seed/angel · India · new announcement · announced ≤ 24 h (fresh) or ≤ 30 days (late catch).
- Processing · *indigo* · **12** — Decides fit: evidence-or-zero, thesis weights, excluded sectors, threshold. Below the bar → hidden from Rohit (audit tab only).
- Processing · *indigo* · **15** — Validates the email: no number that is not in the facts, no links or placeholders, length, signature. One rewrite with feedback, else not drafted.
- Output · *indigo* · **18** — Approve & send is a one-way state change (drafted → sending): a double click sends once. Reject deletes the Gmail draft.

**Row 5 — LLM** (Gemini 3.8 Flash · structured JSON)
- AI · *pink* · **5** — Triage: 25 headlines per call. Is this new money raised by a private startup?
- AI · *pink* · **6** — Extract every round in the article: startup, stage, amount, date, investors, founders, each with a verbatim quote.
- AI · *pink* · **10** — Research brief from fetched pages only; every fact cites its source and quote.
- AI · *pink* · **11** — Fit score 0–10 per thesis criterion with evidence. Never sees the weights or the threshold.
- AI · *pink* · **14** — Writes the email from verified facts only. ✕ no invented claims or numbers

**Row 6 — Database** (Supabase Postgres)
- Context · *teal* · **10a** — Reads the thesis fresh at scoring time. A trigger validates every edit, bumps the version and snapshots it; each assessment stores the version it used.
- Processing · *teal* · **8** — Identity & dedup: startup by website domain, then name; same startup + stage within 21 days = one round (5 articles → 1 round). Already contacted → skipped.
- Output · *teal* · **19** — Contact history: a unique index allows one outreach per startup, ever. Runs, events and every AI call are logged for audit and cost.

**Row 7 — Startup web** (company websites · Hunter.io)
- Context · *teal* · **9** — Website: Gemini + Google Search proposes up to 3 URLs; code accepts one only if it loads and shows the startup's name. Homepage and About pages fetched.
- Context · *teal* · **13** — Contact: email published on the startup's own site, else a Hunter.io founder match verified as deliverable. ✕ never guesses firstname@domain

**Row 8 — Gmail** (rohit.guptaa1141@gmail.com)
- Output · *teal* · **16** — Draft appears in Rohit's Drafts folder (OAuth, compose-only permission, token encrypted). Drafts he sends or deletes in Gmail are detected on the next run. ✕ safe mode: every email goes to a test inbox

---

## NOTE BOXES (under the grid)

**The Cut — three things the engine never does**
1. Never emails a founder or sends on its own. Every draft goes to a safe-mode test inbox; sending needs Rohit's click.
2. Never contacts a startup twice. A database rule allows one outreach per startup, ever.
3. Never invents. Funding facts, founders and contacts must come from fetched sources; quotes are checked by code; emails are never guessed.

**AI proposes, code decides**
Gemini reads, extracts, researches, scores and writes. Everything that must be predictable is code or a database rule: dedup, dates, stage and geography gates, quote checks, weights and threshold, one-outreach-per-startup, send-once. When Rohit edits the thesis, startups not yet drafted are re-scored on the next run: number changes are re-applied by code with no AI call; wording changes ask Gemini again.

**Running cost**
- Gemini per qualified startup (website, research, fit, email): ≈ 6.3k input + 2.5k output tokens (measured) → ≈ $0.014
- Per article (triage + extraction if funding news): ≈ $0.0001–0.002
- Supabase, Vercel, Gmail API, RSS, Hunter.io: free tiers → $0
- Typical day (~200 articles, ~60 funding stories, ~7 qualified): ≈ $0.25
- *Tokens measured from the app's own log; price is a third-party listing for Gemini 3.8 Flash ($0.75 / $3.75 per million tokens).*

**Footer line:** Live app: tandem-forge-outreach.vercel.app · Code: github.com/raghavgombar42/Rohit-s-Dashboard--End-Term-AI
