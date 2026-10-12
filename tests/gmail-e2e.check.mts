// Live end-to-end check against Rohit's real Gmail (safe mode: every email goes to EMAIL_OVERRIDE_TO).
// Usage: npx tsx --env-file=.env.local tests/gmail-e2e.check.mts
import { db } from "../lib/db";
import { deleteDraft, getDraft } from "../lib/gmail";
import { approveAndSend, reject } from "../lib/outreach/actions";
import { runPipeline } from "../lib/pipeline/run";

const sql = db();
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, detail = "") => results.push([name, ok, detail]);
const idOf = async (name: string) =>
  Number((await sql`select o.id from outreach o join startups s on s.id = o.startup_id where s.name = ${name}`)[0].id);

// 1. Every drafted_gmail row really exists in Gmail.
const live = await sql<{ id: number; gmail_draft_id: string; sent_to: string }[]>`select id::int, gmail_draft_id, sent_to from outreach where status = 'drafted_gmail'`;
const exist = await Promise.all(live.map((o) => getDraft(o.gmail_draft_id)));
check("all drafted_gmail rows exist in Gmail Drafts", exist.every(Boolean), `${exist.filter(Boolean).length}/${live.length}`);
check("every draft addressed to the safe-mode inbox", live.every((o) => o.sent_to === process.env.EMAIL_OVERRIDE_TO), live[0]?.sent_to ?? "");

// 2. Approve & send, double-clicked at the same instant → exactly one send.
const zomint = await idOf("Zomint");
const [a, b] = await Promise.all([approveAndSend(zomint), approveAndSend(zomint)]);
const sends = [a, b].filter((r) => r.ok).length;
const [z] = await sql`select status, gmail_message_id, sent_at from outreach where id = ${zomint}`;
check("double approve sends exactly once", sends === 1 && z.status === "sent", `${a.message} | ${b.message}`);
check("sent email has a Gmail message id", !!z.gmail_message_id, z.gmail_message_id ?? "");
const again = await approveAndSend(zomint);
check("approving an already-sent email is refused", !again.ok, again.message);

// 3. Reject → Gmail draft deleted, row kept as history.
const tail = await idOf("TailBlaze Longevity");
const [t0] = await sql`select gmail_draft_id from outreach where id = ${tail}`;
const rj = await reject(tail, "E2E test: no verified founder contact");
check("reject deletes the Gmail draft", rj.ok && (await getDraft(t0.gmail_draft_id)) === null, rj.message);

// 4. Rohit deletes a draft directly in Gmail → next run records closed_in_gmail.
const cred = await idOf("Credfix");
const [c0] = await sql`select gmail_draft_id from outreach where id = ${cred}`;
await deleteDraft(c0.gmail_draft_id);
const run = await runPipeline("test");
const [c1] = await sql`select status from outreach where id = ${cred}`;
check("draft removed in Gmail is detected as closed_in_gmail", c1.status === "closed_in_gmail", c1.status);

// 5. No duplicate outreach: the run created no second draft for any contacted/rejected startup.
const [dups] = await sql`select count(*)::int n from (select startup_id from outreach group by startup_id having count(*) > 1) d`;
check("no startup has more than one outreach row", dups.n === 0, `${dups.n} duplicates`);
check("pipeline run wrote no new drafts for existing startups", !("drafts_written" in ((run as { counts?: Record<string, number> }).counts ?? {})), JSON.stringify((run as { counts?: object }).counts ?? {}));

let ok = true;
for (const [n, pass, d] of results) { ok &&= pass; console.log(`${pass ? "PASS" : "FAIL"}  ${n}${d ? `  — ${d}` : ""}`); }
await sql.end();
process.exitCode = ok ? 0 : 1;
