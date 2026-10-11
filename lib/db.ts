import postgres from "postgres";
import { env } from "./env";

// One pooled client per server instance. On Vercel we point DATABASE_URL at Supabase's
// transaction pooler (port 6543), which requires prepare: false.
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

export function db(): postgres.Sql {
  if (!globalForDb.sql) {
    globalForDb.sql = postgres(env("DATABASE_URL"), {
      prepare: false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 15,
      onnotice: () => {},
      // Return SQL dates as plain YYYY-MM-DD strings (no timezone shifting).
      types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
    });
  }
  return globalForDb.sql;
}
