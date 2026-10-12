import { db } from "../db";
import { ensureModelAvailable } from "../gemini";
import { refreshDashboard } from "../refresh";
import { createContext, type RunContext, type RunTrigger } from "./context";
import { ingestStage } from "./ingest";
import { triageStage } from "./triage";
import { extractStage } from "./extract";
import { assessStage, rescoreUndrafted } from "./assess";
import { draftStage, gmailSyncStage } from "./draft";

type Stage = { name: string; run: (ctx: RunContext) => Promise<void> };

// Stages run in order. Each one only picks up items in the state it owns, so an
// interrupted run is simply resumed by the next one.
const STAGES: Stage[] = [
  { name: "ingest", run: ingestStage },
  { name: "triage", run: triageStage },
  { name: "extract", run: extractStage },
  { name: "assess", run: assessStage },
  // Thesis edited since a round was scored? Re-score it (only if not drafted/contacted yet).
  { name: "rescore", run: rescoreUndrafted },
  { name: "draft", run: draftStage },
  { name: "gmail", run: gmailSyncStage },
];

const STALE_LOCK_MINUTES = 10;

export type RunResult =
  | { status: "skipped"; reason: string }
  | { status: "succeeded" | "partial" | "failed"; runId: number; counts: Record<string, number>; error?: string };

async function acquireLock(trigger: RunTrigger): Promise<number | null> {
  const sql = db();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const [row] = await sql<{ id: number }[]>`insert into pipeline_runs (trigger) values (${trigger}) returning id`;
      return row.id;
    } catch (e) {
      if ((e as { code?: string }).code !== "23505") throw e; // not the run-lock violation
      // Another run holds the lock. If it has been "running" too long it crashed: release it.
      const released = await sql`
        update pipeline_runs set status = 'failed', finished_at = now(), error = 'Stale lock released (run exceeded time limit)'
        where status = 'running' and started_at < now() - make_interval(mins => ${STALE_LOCK_MINUTES})
        returning id`;
      if (released.length === 0) return null;
    }
  }
  return null;
}

export async function runPipeline(trigger: RunTrigger, budgetMs = 240_000): Promise<RunResult> {
  const runId = await acquireLock(trigger);
  if (runId === null) return { status: "skipped", reason: "Another pipeline run is in progress" };

  const ctx = createContext(runId, trigger, budgetMs);
  const sql = db();
  let fatal: string | undefined;

  // Rule from the course key document: confirm the model still exists before using it.
  const model = await ensureModelAvailable().catch((e) => ({ ok: true, id: "?", message: String(e) }));
  if (model.message) await ctx.log(model.ok ? "warn" : "error", "model", model.message);
  const stages = model.ok ? STAGES : STAGES.filter((s) => s.name === "ingest");

  for (const stage of stages) {
    if (ctx.timeLeft() <= 0) {
      await ctx.log("warn", stage.name, "Time budget used up; remaining work continues next run");
      break;
    }
    try {
      await stage.run(ctx);
    } catch (e) {
      fatal = `${stage.name}: ${(e as Error).message}`;
      await ctx.log("error", stage.name, `Stage crashed: ${(e as Error).message}`);
      break;
    }
  }

  const status = fatal ? "failed" : ctx.hadErrors || (ctx.counts.feeds_failed ?? 0) > 0 ? "partial" : "succeeded";
  await sql`
    update pipeline_runs set status = ${status}, finished_at = now(), counts = ${sql.json(ctx.counts)}, error = ${fatal ?? null}
    where id = ${runId}`;
  refreshDashboard(); // new data is visible on the next page view
  return { status, runId, counts: ctx.counts, error: fatal };
}
