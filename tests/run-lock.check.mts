// Live check: two pipeline runs started at the same moment → exactly one runs, one is skipped.
// Usage: npx tsx --env-file=.env.local tests/run-lock.check.mts
import { runPipeline } from "../lib/pipeline/run";
import { db } from "../lib/db";
const [a, b] = await Promise.all([runPipeline("test"), runPipeline("test")]);
const skipped = [a, b].filter((r) => r.status === "skipped").length;
console.log(skipped === 1 ? "PASS" : "FAIL", " concurrent runs → statuses:", a.status, b.status);
await db().end();
process.exitCode = skipped === 1 ? 0 : 1;
