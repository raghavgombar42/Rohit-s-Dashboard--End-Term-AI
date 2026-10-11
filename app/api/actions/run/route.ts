import { after, NextResponse, type NextRequest } from "next/server";
import { OPERATOR_COOKIE, isOperator } from "@/lib/auth";
import { runPipeline } from "@/lib/pipeline/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// "Run now" button. Responds immediately and runs the pipeline after the response;
// the Runs page shows it as "running" and the run lock prevents overlaps.
export async function POST(request: NextRequest) {
  if (!(await isOperator(request.cookies.get(OPERATOR_COOKIE)?.value))) {
    return NextResponse.json({ error: "Operator mode required" }, { status: 401 });
  }
  after(async () => {
    const r = await runPipeline("manual");
    if (r.status === "skipped") console.log("Manual run skipped:", r.reason);
  });
  return NextResponse.redirect(new URL("/runs?started=1", request.url), 303);
}
