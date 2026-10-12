// Read-only Gmail check: token refreshes, and every draft the app thinks is in Gmail really is there.
import { db } from "../lib/db";
import { getDraft, gmailStatus } from "../lib/gmail";
const sql = db();
const s = await gmailStatus();
console.log(s?.account_email ? `PASS  connected as ${s.account_email}` : "FAIL  not connected");
const rows = await sql<{ id: number; gmail_draft_id: string; startup: string }[]>`
  select o.id::int, o.gmail_draft_id, st.name as startup from outreach o join startups st on st.id = o.startup_id where o.status = 'drafted_gmail'`;
const found = await Promise.all(rows.map(async (r) => ({ ...r, exists: (await getDraft(r.gmail_draft_id)) !== null })));
console.log(`${found.every((f) => f.exists) ? "PASS" : "FAIL"}  drafts present in Gmail: ${found.filter((f) => f.exists).map((f) => f.startup).join(", ")} (${found.filter((f) => f.exists).length}/${found.length})`);
const [dup] = await sql`select count(*)::int n from (select startup_id from outreach group by 1 having count(*) > 1) x`;
console.log(`${dup.n === 0 ? "PASS" : "FAIL"}  duplicate outreach rows: ${dup.n}`);
await sql.end();
