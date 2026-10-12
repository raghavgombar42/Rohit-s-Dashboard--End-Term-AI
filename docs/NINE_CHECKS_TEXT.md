# The Nine Checks — exact content + ChatGPT prompt

Format from class: **Kill Switches** (any No = don't build) · **Sizing** (any No = build something smaller) · **Boundary** (any No = put a human exactly here).

Answers are deliberately honest. A **YES** is backed by the brief or by something we measured. **PARTIAL** or **NO** says what we could not prove and how the build responds. Inside Boundary, a NO is not a failure: it marks exactly where a human sits.

---

## Prompt to paste into ChatGPT

> Create a **one-page landscape A4 slide** (high-resolution image and a PDF) titled **"The Nine Checks — Should the Timed Funding Outreach Engine Be Built, and How Big?"** with the subtitle **"Mesa C4 · AI Final · Problem Statement 6 · Rohit, Tandem Forge Accelerator (fictional)"**.
>
> Use **three columns**, each a card with a coloured header:
> - **⚡ Kill Switches** (red header), caption "Any No means: don't build it" → checks 01, 02, 03
> - **📊 Sizing** (indigo header), caption "Any No means: build something smaller" → checks 04, 05, 08
> - **🚧 Boundary** (amber header), caption "Any No means: put a human exactly here" → checks 06, 07, 09
>
> Each check is a row: number and question in bold, then a verdict pill, then two labelled lines: **"Evidence:"** and **"So we…:"**. Verdict pill colours: **YES** = green, **PARTIAL** = amber, **NO → HUMAN HERE** = red-orange. Use the text exactly as given, without inventing or changing any numbers or wording.
> At the bottom, a full-width verdict bar: **"Verdict: BUILD — but smaller, with humans at three boundaries."** Under it, three small chips: **"Kill switches: pass"** · **"Sizing: partial → scoped down"** · **"Boundary: 1 NO, 2 PARTIAL → Rohit approves, owns the thesis, audit view"**. Then a thin red line: **"The Cut: never emails a founder automatically, never contacts a startup twice, never invents facts or contacts."**
> Clean, modern, consulting style; sans-serif body, serif title; readable when printed.
>
> **Content:** (paste everything from "KILL SWITCHES" to the end below)

---

## KILL SWITCHES — any No means: don't build it  → *Result: pass*

**01 · Problem real? — YES**
Evidence: The brief says Rohit misses 30–40% of seed/pre-seed announcements and spends ~20 minutes per startup on research and drafting; outreach 30–60 days after a raise converts far better.
So we… build. Caveat: Rohit is a case persona; the pain is taken from the brief, not validated with a real recruiter.

**02 · Workflow repeated? — YES**
Evidence: Daily, all year. On our first live run the feeds carried 266 items, 59 funding stories and 14 rounds that passed the rules.
So we… automate it on an hourly schedule.

**03 · Input available? — PARTIAL**
Evidence: Funding news is public and live (9 working RSS feeds). But Google News links give no article text, Economic Times blocks servers, 2 of 7 qualified startups had no verifiable email, and Hunter's free tier is 50 searches a month.
So we… use direct feeds for text, label snippet-only evidence, and write "no verified contact" instead of guessing.

## SIZING — any No means: build something smaller  → *Result: partial, so scoped down*

**04 · Output valuable? — PARTIAL (unproven)**
Evidence: Every qualified startup gets a researched, personalised draft in Gmail (7 on day one). But no real recruiter has judged draft quality yet.
So we… keep drafts, not sends, and record every Reject reason so quality can be judged over time.

**05 · Impact measurable? — PARTIAL**
Evidence: Activity is fully logged (runs, AI calls, rounds, drafts, rejects, 0 duplicate outreach). The business outcome is not: founder replies and cohort sign-ups are not tracked, discovery coverage needs a manual baseline, and edits made inside Gmail are invisible.
So we… report activity metrics now and name replies and coverage as the next metrics.

**08 · ROI worth it? — PARTIAL**
Evidence: Cost is measured at ≈ $0.014 of AI per researched draft, ≈ $0.25 a day, everything else on free tiers. The benefit (~20 minutes saved per startup, fewer missed deals) is estimated from the brief, not measured.
So we… build small: India only, 9 feeds, one email per startup, no CRM, no auto-send.

## BOUNDARY — any No means: put a human exactly here  → *Result: humans placed at 3 points*

**06 · Failure risk OK without a human? — NO → human here**
Evidence: The worst failure, a wrong or embarrassing email to a real founder, can't be undone.
So we… make Rohit approve every send, route every email to a safe-mode test inbox, check facts against sources in code, and block any second email with a database rule.

**07 · Judgment protected? — PARTIAL**
Evidence: Rohit owns the two big calls: the thesis (he edits it in Supabase) and the send decision. But a startup the AI wrongly scores as a non-fit is hidden from him by design.
So we… keep every rejection and score breakdown in a Filtered-out audit view, and re-score unsent startups whenever he changes the thesis.

**09 · Owner clear? — PARTIAL**
Evidence: Rohit clearly owns the outreach. Nobody is named for the system itself: a feed breaking, the Gmail connection expiring, Gemini quota.
So we… surface health on the Setup and Pipeline-runs pages. A real deployment needs a named technical owner.

---

**Verdict: BUILD — but smaller, with humans at three boundaries.**
Kill switches: pass · Sizing: partial → scoped down · Boundary: 1 NO, 2 PARTIAL → Rohit approves every send, owns the thesis, and has the audit view.
**The Cut:** never emails a founder automatically, never contacts a startup twice, never invents facts or contacts.
