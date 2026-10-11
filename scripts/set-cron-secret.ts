// Stores CRON_SECRET in Supabase Vault so pg_cron can authenticate to /api/cron/run.
// Usage: npx tsx --env-file=.env.local scripts/set-cron-secret.ts
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const secret = process.env.CRON_SECRET;
if (!secret) throw new Error("CRON_SECRET not set");
(async () => {
  const [existing] = await sql`select id from vault.secrets where name = 'cron_secret'`;
  if (existing) await sql`select vault.update_secret(${existing.id}::uuid, ${secret})`;
  else await sql`select vault.create_secret(${secret}, 'cron_secret', 'Bearer secret for /api/cron/run')`;
  const [check] = await sql`select (decrypted_secret = ${secret}) as ok from vault.decrypted_secrets where name = 'cron_secret'`;
  console.log("vault cron_secret stored:", check?.ok === true);
})().finally(() => sql.end());
