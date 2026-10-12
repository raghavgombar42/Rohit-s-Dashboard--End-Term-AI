import postgres from "postgres";
import { env } from "./env";

// One pooled client per server instance. On Vercel we point DATABASE_URL at Supabase's
// transaction pooler (port 6543), which requires prepare: false.
//
// Serverless hazard (seen in production): Vercel can freeze an instance while a connection is
// mid-conversation with the pooler; a later request that picks that stale connection waits forever.
// Mitigations: short-lived connections, TCP keep-alive, a small pool, and `resilient()` below,
// which times out a page's data load, throws the whole pool away and retries once on fresh sockets.
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

function create(): postgres.Sql {
  return postgres(env("DATABASE_URL"), {
    prepare: false,
    max: 4,
    idle_timeout: 10, // seconds: drop idle sockets quickly (frozen instances wake up with fresh ones)
    max_lifetime: 60 * 5, // seconds: recycle every connection regularly
    connect_timeout: 10,
    keep_alive: 15, // TCP keep-alive to detect dead sockets sooner
    onnotice: () => {},
    // Return SQL dates as plain YYYY-MM-DD strings (no timezone shifting).
    types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
  });
}

export function db(): postgres.Sql {
  if (!globalForDb.sql) globalForDb.sql = create();
  return globalForDb.sql;
}

/**
 * Stop handing out the current pool (it may hold a stale socket); the next db() call gets a fresh one.
 * The old pool is NOT ended: a pipeline run in the same instance may still be using it. Its idle
 * sockets close via idle_timeout and the pool is garbage-collected.
 */
export function resetDb() {
  globalForDb.sql = undefined;
}

class DbTimeout extends Error {}

/**
 * Run a page's data loading with a deadline. On timeout or a connection-level error, reset the pool
 * and retry once. Turns a 300-second hang into, at worst, a ~8-second retry.
 */
export async function resilient<T>(load: () => Promise<T>, timeoutMs = 8000): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        load(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new DbTimeout(`Database did not answer within ${timeoutMs} ms`)), timeoutMs);
        }),
      ]);
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      const connectionProblem =
        e instanceof DbTimeout || code === "57014" || code === "CONNECTION_CLOSED" || code === "CONNECTION_ENDED" || code === "CONNECT_TIMEOUT" || code === "ECONNRESET";
      if (!connectionProblem || attempt === 1) throw e;
      resetDb();
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("unreachable");
}
