import { NextResponse, type NextRequest } from "next/server";
import { isValidCronAuth } from "@/lib/auth";
import { runPipeline } from "@/lib/pipeline/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel Hobby ceiling; the pipeline stops taking new work at 240s.

// Called hourly by Supabase pg_cron (POST) and daily by Vercel Cron (GET).
// Both send "Authorization: Bearer <CRON_SECRET>".
async function handle(request: NextRequest) {
  if (!isValidCronAuth(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const trigger = request.nextUrl.searchParams.get("trigger") === "cron_daily" ? "cron_daily" : "cron_hourly";
  const result = await runPipeline(trigger);
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
