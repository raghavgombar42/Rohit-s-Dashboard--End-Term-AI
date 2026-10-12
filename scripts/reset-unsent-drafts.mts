// Dev helper: discard drafts that never reached Gmail (status drafted_db, no gmail_draft_id) so they are rewritten.
// Never touches anything that reached Gmail or was sent — that is contact history.
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
await sql.begin(async (tx) => {
  const gone = await tx`delete from outreach where status = 'drafted_db' and gmail_draft_id is null returning round_id`;
  if (gone.length) await tx`update funding_rounds set status = 'qualified', attempts = 0 where id = any(${gone.map((g) => g.round_id)}::bigint[])`;
  console.log("reset", gone.length, "unsent drafts");
});
await sql`update funding_rounds set attempts = 0 where status = 'qualified'`;
await sql.end();
