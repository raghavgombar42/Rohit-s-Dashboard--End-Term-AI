# Demo video script — Timed Funding Outreach Engine (target 4–5 min)

**Record:** full screen, 1080p, with your voice. Close other tabs. Use Chrome at 100% zoom.

**Have open in tabs before you start:**
1. https://tandem-forge-outreach.vercel.app, with operator mode already unlocked (top right → passcode).
2. Rohit's Gmail (rohit.guptaa1141@gmail.com), on the **Drafts** folder.
3. Supabase → project → **Table Editor → `thesis`** (row id 1).
4. https://tandem-forge-outreach.vercel.app/components-map.html

> Do the thesis demo (scene 6) only once. It creates two real drafts (to the test inbox). Afterwards, set the threshold back to 65.

---

### Scene 1 — The problem (0:00–0:30) · *Overview page*
**Say:** "Rohit recruits founders for an accelerator. The best time to reach a founder is right after a seed round. Today he checks a few news sites by hand, misses 30 to 40 percent of announcements, and spends twenty minutes on each email. This engine does it every hour and leaves researched drafts in his Gmail."
**Show:** the greeting "You have N researched drafts waiting in Gmail", the four stat cards, and the **How it works** strip. Point at the AI / code / Rohit tags.

### Scene 2 — Live data, and only the right data (0:30–1:20) · *Discoveries → Funding rounds → Filtered out*
**Say:** "Nine live feeds, polled hourly by Supabase pg_cron. Same URL stored once; the same headline from another outlet is kept as a source but never sent to the AI again."
**Show:** **Discoveries**, "Last 24 hours", then click **Duplicates caught**.
**Say:** "Gemini spots funding news and extracts each round with a word-for-word quote. Code checks the quote really exists, then applies hard rules: pre-seed or seed, India, newly announced, inside the 30-day window."
**Show:** **Funding rounds**, open one card's **Evidence & sources**, then the **Filtered out** tab. Nat Habit's Series C and the Series A rounds are rejected with plain-English reasons.

### Scene 3 — Research and thesis fit (1:20–2:10) · *Qualified*
**Say:** "For each surviving startup, Gemini proposes a website and code confirms the name is actually on the page. The brief uses only pages we fetched, and every fact links to its source. Gemini scores each thesis criterion with evidence. It never sees the weights or the pass mark. Code does the maths and makes the call."
**Show:** Zomint's card: score ring, research facts with [A1]/[W1] links (hover one), criteria bars with evidence quotes, "thesis v5".

### Scene 4 — The draft in Gmail (2:10–3:00) · *Drafts → Gmail*
**Say:** "Every qualified startup gets a personalised email written only from verified facts. Code rejects any number not in the facts, any link or placeholder. The founder's address comes from their own website or a Hunter-verified match, never guessed. Safe mode: every email goes to a test inbox."
**Show:** **Drafts**, one card (To = test inbox, Founder contact = e.g. harshit@zinara.in, verified). Switch to the **Gmail tab → Drafts**: the same emails are sitting there.

### Scene 5 — Rohit stays in control (3:00–3:35) · *Drafts*
**Show:** click **✓ Approve & send** on one draft (e.g. KILRR). The green "Sent" banner appears and the card moves to **Contact history**.
**Say:** "Sending is a one-way database transition, so a double click sends once. Rejecting deletes the Gmail draft. Either way the startup is in contact history, and a unique index means it can never be drafted again."
**Show (optional):** the Gmail inbox shows the email arriving at the +founders address.

### Scene 6 — Change the thesis in Supabase, no code (3:35–4:30) · *Supabase → app*
**Say:** "The accelerator's thesis lives in Supabase. Rohit can change it without touching code."
**Show:**
1. Supabase `thesis` row: change **threshold 65 → 58** and save. Optionally refresh the app's **Thesis** page: the version number goes up.
2. App: click **▶ Run now**, wait ~1 minute, then open **Pipeline runs** → newest run → event log shows "thesis v6 changed only numbers → … (no AI call)" and new drafts written.
3. **Qualified** now includes **The Dough Therapy (61)** and **Kinetic Age (59)**, and **Drafts / Gmail** has their emails.

**Say:** "Every edit is versioned by a database trigger, and each score records which version it used. A threshold change is re-applied by code instantly. A change in wording would ask Gemini again. Startups already contacted are never touched."

### Scene 7 — Architecture and close (4:30–5:00) · *Components map tab*
**Say:** "Here's the whole system: actors down the side, trigger to output across. Pink is Gemini, blue is code, teal is data. The rule throughout: AI proposes, code decides. It never emails a founder, never contacts a startup twice and never invents facts."

**After recording:** in Supabase set **threshold back to 65**.
