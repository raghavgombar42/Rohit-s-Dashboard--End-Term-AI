# The Nine Checks — exact content + ChatGPT prompt (v3)

Format from class: **Kill Switches** (any No = don't build) · **Sizing** (any No = build something smaller) · **Boundary** (any No = put a human exactly here).

Each answer is about the build decision ("should this be built, at what size, and where does a human sit?"), not about proof the product succeeds. Caveats are stated where they matter.

**Result: 7 YES · 1 PARTIAL (05, the real gap) · 1 NO (06, which is exactly where Rohit sits).**

---

## Prompt to paste into ChatGPT

> Create a **one-page landscape A4 slide** (high-resolution PNG and a PDF) titled **"The Nine Checks — Should the Timed Funding Outreach Engine Be Built?"**, subtitle **"Mesa C4 · AI Final · Problem Statement 6 · Rohit, Tandem Forge Accelerator (fictional)"**.
>
> **Layout:** three equal columns, each a card with a coloured header strip and a one-line caption:
> - **Kill Switches** (red), "Any No means: don't build it" → 01, 02, 03
> - **Sizing** (indigo), "Any No means: build something smaller" → 04, 05, 08
> - **Boundary** (amber), "Any No means: put a human exactly here" → 06, 07, 09
>
> Each check is a block: **number + question in bold** on the left, a **verdict pill** on the right (**YES** = green, **PARTIAL** = amber, **NO → HUMAN HERE** = red-orange), then **at most two short lines** of body text beneath it. Use the text exactly as given; do not add, reword or change any numbers.
> **Typography:** body text at least 10.5 pt, headings 13 pt, title in an elegant serif, body in a clean sans-serif. Generous white space; no empty boxes; columns end at the same height.
> **Bottom:** a full-width green bar, **"Verdict: BUILD — at this scope, with Rohit approving every send."**, and under it one line of three small chips: **"Kill switches: 3/3 YES"** · **"Sizing: 2 YES, 1 PARTIAL"** · **"Boundary: 1 NO → human placed, 2 YES"**. Then a thin red line: **"The Cut: never emails a founder automatically, never contacts a startup twice, never invents facts or contacts."**
> Use only plain characters (no special symbols that may not render).
>
> **Content:** (paste everything from "KILL SWITCHES" to the end)

---

## KILL SWITCHES — any No means: don't build it

**01 · Problem real? — YES**
Rohit misses 30–40% of seed/pre-seed announcements and spends ~20 min per startup on research and drafting (case brief).
Caveat: Rohit is a case persona; the pain is from the brief, not a real-user interview.

**02 · Workflow repeated? — YES**
Daily, all year. First live run: 266 news items → 59 funding stories → 14 rounds that passed the rules.

**03 · Input available? — YES**
Funding news is public and live: 9 working RSS feeds, polled hourly.
Caveat: founder emails are thin (2 of 7 had none), so drafts say "no verified contact" instead of guessing.

## SIZING — any No means: build something smaller

**04 · Output valuable? — YES**
It is exactly what the brief asks for: a researched, personalised draft in Rohit's Gmail for each startup that fits (7 on day one).

**05 · Impact measurable? — PARTIAL**
Activity is fully logged: runs, rounds, drafts, rejects, 0 duplicate outreach.
Not yet tracked: founder replies and sign-ups, the outcome that matters. That's the next metric.

**08 · ROI worth it? — YES**
About $0.085 of AI per researched draft (OpenRouter-reported), under $1 a day; every other service on a free tier.
It pays for itself if it saves Rohit a few minutes a day; manual work is ~20 min per startup.

## BOUNDARY — any No means: put a human exactly here

**06 · Failure risk OK without a human? — NO → HUMAN HERE**
A wrong or embarrassing email to a real founder can't be undone.
So Rohit approves every send; safe mode routes every email to a test inbox until then.

**07 · Judgment protected? — YES**
Rohit owns both judgment calls: what fits (he edits the thesis in Supabase) and what gets sent. The AI only scores against his rules.
Rejected startups stay visible in an audit view, in case the AI misjudges one.

**09 · Owner clear? — YES**
Rohit owns the thesis, the drafts and every send. Pipeline health is on the Setup and Pipeline-runs pages.
Caveat: a real deployment would also name a technical owner.

---

**Verdict: BUILD — at this scope, with Rohit approving every send.**
Kill switches: 3/3 YES · Sizing: 2 YES, 1 PARTIAL · Boundary: 1 NO → human placed, 2 YES
**The Cut:** never emails a founder automatically, never contacts a startup twice, never invents facts or contacts.
