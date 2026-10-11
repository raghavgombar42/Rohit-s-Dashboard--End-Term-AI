// Dev helper: run a read-only SQL query and print rows. Usage: npx tsx --env-file=.env.local scripts/sql.mts "select ..."
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
try { console.table(await sql.unsafe(process.argv[2])); } finally { await sql.end(); }
