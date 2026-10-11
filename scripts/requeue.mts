// Re-queue articles for extraction (e.g. after a prompt or gate fix). Usage: requeue.mts "<reject_reason ILIKE pattern>"
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const r = await sql`update articles set status = 'candidate', attempts = 0, extraction = null, reject_reason = null
                    where status = 'rejected' and reject_reason ilike ${process.argv[2]} returning id`;
console.log("requeued", r.length);
await sql.end();
