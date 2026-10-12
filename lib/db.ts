import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "postgres";
import { env } from "./env";

// How the app connects to Supabase, and why (all three problems were seen in production on 2026-10-12):
//
// 1. Transaction pooler (6543): under concurrent page loads it mixed up queries from different clients
//    ("bind message supplies 1 parameters, but prepared statement requires 0") and hung pipelined queries.
//    → We use the SESSION pooler (5432): each client gets its own real Postgres connection.
// 2. Session pooler allows ~15 clients in total. Long-lived pools in serverless instances that Vercel
//    froze kept their sockets open and exhausted the slots ("max clients reached").
//    → Page loads use a request-scoped client (`resilient()`) that is ALWAYS closed afterwards,
//      and the pipeline's client releases idle sockets within seconds.
// 3. Any remaining hiccup is bounded by an 8 s deadline with retry instead of a 300 s hang.
// Pages are additionally served from a short-lived data cache (lib/cached.ts), so most clicks never touch
// the database at all.

type Sql = postgres.Sql;

const OPTIONS: postgres.Options<Record<string, postgres.PostgresType>> = {
  prepare: false,
  connect_timeout: 10,
  keep_alive: 15,
  onnotice: () => {},
  // Return SQL dates as plain YYYY-MM-DD strings (no timezone shifting).
  types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
};

const requestScope = new AsyncLocalStorage<Sql>();
const globalForDb = globalThis as unknown as { sql?: Sql };

/** Inside a page load: the request-scoped client. Elsewhere (pipeline, scripts): one small shared client. */
export function db(): Sql {
  const scoped = requestScope.getStore();
  if (scoped) return scoped;
  if (!globalForDb.sql) globalForDb.sql = postgres(env("DATABASE_URL"), { ...OPTIONS, max: 3, idle_timeout: 5, max_lifetime: 60 * 5 });
  return globalForDb.sql;
}

class DbTimeout extends Error {}

const isPoolFull = (e: unknown) => /EMAXCONN|max clients reached/i.test(String((e as Error)?.message));

function isConnectionProblem(e: unknown): boolean {
  const code = (e as { code?: string }).code ?? "";
  return (
    e instanceof DbTimeout ||
    isPoolFull(e) ||
    ["57014", "08P01", "CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECT_TIMEOUT", "ECONNRESET", "ETIMEDOUT"].includes(code)
  );
}

/**
 * Run a page's data loading on a fresh, request-scoped connection with a deadline.
 * Connection-level failures are retried (up to 3 attempts; a full pool waits for slots to free up).
 * The connection is always closed afterwards, so nothing can go stale between requests.
 */
export async function resilient<T>(load: () => Promise<T>, timeoutMs = 8000): Promise<T> {
  const attempts = 3;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const sql = postgres(env("DATABASE_URL"), { ...OPTIONS, max: 2, idle_timeout: 0 });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        requestScope.run(sql, load),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new DbTimeout(`Database did not answer within ${timeoutMs} ms`)), timeoutMs);
        }),
      ]);
    } catch (e) {
      if (!isConnectionProblem(e) || attempt === attempts - 1) throw e;
      if (isPoolFull(e)) await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
      sql.end({ timeout: 1 }).catch(() => {});
    }
  }
  throw new Error("unreachable");
}
