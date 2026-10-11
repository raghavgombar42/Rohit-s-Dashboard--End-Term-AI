import { db } from "../db";

export type RunTrigger = "cron_hourly" | "cron_daily" | "manual" | "replay" | "test";

export type RunContext = {
  runId: number;
  trigger: RunTrigger;
  deadline: number; // epoch ms; stages stop picking up new work after this
  counts: Record<string, number>;
  hadErrors: boolean;
  timeLeft(): number;
  bump(key: string, by?: number): void;
  log(level: "info" | "warn" | "error", stage: string, message: string, extra?: { entityType?: string; entityId?: number; data?: unknown }): Promise<void>;
};

export function createContext(runId: number, trigger: RunTrigger, budgetMs: number): RunContext {
  const ctx: RunContext = {
    runId,
    trigger,
    deadline: Date.now() + budgetMs,
    counts: {},
    hadErrors: false,
    timeLeft: () => ctx.deadline - Date.now(),
    bump(key, by = 1) {
      ctx.counts[key] = (ctx.counts[key] ?? 0) + by;
    },
    async log(level, stage, message, extra) {
      if (level === "error") ctx.hadErrors = true;
      try {
        await db()`
          insert into run_events (run_id, level, stage, entity_type, entity_id, message, data)
          values (${runId}, ${level}, ${stage}, ${extra?.entityType ?? null}, ${extra?.entityId ?? null}, ${message},
                  ${extra?.data === undefined ? null : db().json(extra.data as never)})`;
      } catch (e) {
        console.error("run_events insert failed", e);
      }
    },
  };
  return ctx;
}
