// Runs the pipeline once from the command line. Usage: npm run pipeline [-- trigger]
import { runPipeline } from "../lib/pipeline/run";
import { db } from "../lib/db";

const trigger = (process.argv[2] ?? "manual") as Parameters<typeof runPipeline>[0];
runPipeline(trigger)
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db().end());
