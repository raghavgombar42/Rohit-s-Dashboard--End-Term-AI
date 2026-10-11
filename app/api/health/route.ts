import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public liveness check: confirms the deployment can reach Supabase. Exposes no data.
export async function GET() {
  try {
    const [row] = await db()`select version from thesis where id = 1`;
    return NextResponse.json({ ok: true, db: "reachable", thesis_version: row?.version ?? null });
  } catch {
    return NextResponse.json({ ok: false, db: "unreachable" }, { status: 503 });
  }
}
