import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "postgres";
import { env } from "./env";

// Serverless lesson (seen in production): pooled sockets kept between requests go stale when Vercel
// freezes an instance. With the transaction pooler a stale socket made queries hang until the 300 s
// function limit; with the session pooler frozen instances leaked slots until "max clients reached".
//
// So page loads never reuse sockets: `resilient()` opens a fresh, request-scoped client, runs the page's
// queries on it, and closes it when the page is done. Code outside a page load (pipeline runs, scripts)
// uses one long-lived client per invocation. DATABASE_URL on Vercel = Supabase transaction pooler (6543),
// which accepts many short-lived clients; prepare: false is required there.

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

export function db(): Sql {
  const scoped = requestScope.getStore();
  if (scoped) return scoped;
  if (!globalForDb.sql) globalForDb.sql = postgres(env("DATABASE_URL"), { ...OPTIONS, max: 3, idle_timeout: 20, max_lifetime: 60 * 5 });
  return globalForDb.sql;
}

class DbTimeout extends Error {}

function isConnectionProblem(e: unknown): boolean {
  const code = (e as { code?: string }).code ?? "";
  return (
    e instanceof DbTimeout ||
    /EMAXCONN|max clients reached/i.test(String((e as Error).message)) ||
    ["57014", "CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECT_TIMEOUT", "ECONNRESET", "ETIMEDOUT"].includes(code)
  );
}

/**
 * Run a page's data loading on a fresh, request-scoped connection with a deadline.
 * On a timeout or connection-level error it retries once on another fresh connection.
 * The connection is always closed afterwards, so nothing can go stale between requests.
 */
export async function resilient<T>(load: () => Promise<T>, timeoutMs = 8000): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const sql = postgres(env("DATABASE_URL"), { ...OPTIONS, max: 3, idle_timeout: 0 });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        requestScope.run(sql, load),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new DbTimeout(`Database did not answer within ${timeoutMs} ms`)), timeoutMs);
        }),
      ]);
    } catch (e) {
      if (!isConnectionProblem(e) || attempt === 1) throw e;
    } finally {
      clearTimeout(timer);
      sql.end({ timeout: 2 }).catch(() => {});
    }
  }
  throw new Error("unreachable");
}
