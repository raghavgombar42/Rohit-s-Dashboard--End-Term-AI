# The Nine Checks — exact content + ChatGPT prompt

Format from class: **Kill Switches** (any No = don't build) · **Sizing** (any No = build something smaller) · **Boundary** (any No = put a human exactly here). Every answer below is backed by the PDF or by something we measured or built. Nothing is hypothetical.

---

## Prompt to paste into ChatGPT

> Create a **one-page landscape A4 slide** (high-resolution image and a PDF) titled **"The Nine Checks — Does the Timed Funding Outreach Engine Deserve to Be Built?"** with the subtitle **"Mesa C4 · AI Final · Problem Statement 6 · Rohit, Tandem Forge Accelerator (fictional)"**.
>
> Use **three columns**, each a card with a coloured header:
> - **⚡ Kill Switches** (red header) with the caption "Any No means: don't build it" → checks 01, 02, 03
> - **📊 Sizing** (indigo header) with the caption "Any No means: build something smaller" → checks 04, 05, 08
> - **🚧 Boundary** (amber header) with the caption "Any No means: put a human exactly here" → checks 06, 07, 09
>
> Each check is a row: the number and question in bold, a green **"YES"** pill, then the evidence in 1–3 short lines (use the text exactly as given, without inventing or changing numbers).
> At the bottom, a full-width green verdict bar: **"Verdict: BUILD — with Rohit as the approval gate before any email is sent."** Under it, a thin red "The Cut" line: **"The Cut: the engine never emails a founder automatically, never contacts a startup twice, and never invents facts or contacts."**
> Clean, modern, consulting style; sans-serif body, serif title; generous spacing; readable when printed.
>
> **Content:** (paste everything from "KILL SWITCHES" to the end below)

---

## KILL SWITCHES — any No means: don't build it

**01 · Problem real? — YES**
Rohit misses 30–40% of seed/pre-seed announcements and spends ~20 minutes researching and drafting each email (problem statement). Outreach 30–60 days after a raise converts far better than months later, so delay costs deals.

**02 · Workflow repeated? — YES**
It happens every day, all year: watch the news, filter, research, write. On our first live day the feeds carried 266 items, with 59 funding stories and 14 rounds that passed the rules.

**03 · Input available? — YES**
Funding news is public and live: 9 working RSS feeds (Inc42, Entrackr, YourStory, ET, TechCrunch, Google News…), checked from Vercel's servers. Thesis in Supabase; company websites public; Hunter.io for founder emails.

## SIZING — any No means: build something smaller

**04 · Output valuable? — YES**
Rohit gets a ready, personalised email in his Gmail Drafts for each startup that fits, with a research brief and score breakdown. On day one: 7 qualified startups and 7 drafts; 3 with verified founder emails, 2 with company addresses, 2 flagged "no verified contact".

**05 · Impact measurable? — YES**
Every run, article, AI call and email is logged: discovery counts, time from announcement to draft, qualification rate, rejects with reasons, duplicates prevented (0 duplicate outreach), drafts sent or rejected by Rohit.

**08 · ROI worth it? — YES**
≈ $0.014 of AI per researched draft and ≈ $0.25 a day; every other service runs on a free tier. That replaces ~20 minutes of manual research and writing per startup, plus the deals missed today.

## BOUNDARY — any No means: put a human exactly here

**06 · Failure risk OK? — YES, by design**
The worst failure is a wrong or embarrassing email, so nothing is sent automatically. Safe mode routes every email to a test inbox; facts must be quoted from sources and checked by code; a database rule blocks any second email to the same startup.

**07 · Judgment protected? — YES**
Rohit owns the two judgment calls: what the accelerator looks for (he edits the thesis in Supabase) and whether an email goes out (Approve & send / Reject). The AI scores and writes; code applies Rohit's rules; Rohit decides.

**09 · Owner clear? — YES**
Rohit owns the thesis, the drafts and every send. The pipeline is visible to him on the dashboard: Pipeline runs, Setup and the Filtered-out audit show what ran, what failed and why.

---

**Verdict: BUILD — with Rohit as the approval gate before any email is sent.**
**The Cut:** the engine never emails a founder automatically, never contacts a startup twice, and never invents facts or contacts.
