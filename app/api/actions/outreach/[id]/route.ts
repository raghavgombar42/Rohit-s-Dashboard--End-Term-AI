import { NextResponse, type NextRequest } from "next/server";
import { OPERATOR_COOKIE, isOperator } from "@/lib/auth";
import { approveAndSend, reject } from "@/lib/outreach/actions";
import { refreshDashboard } from "@/lib/refresh";

export const dynamic = "force-dynamic";

// Form POST from the Drafts page: intent=send | reject (+ reason).
export async function POST(request: NextRequest, ctx: RouteContext<"/api/actions/outreach/[id]">) {
  if (!(await isOperator(request.cookies.get(OPERATOR_COOKIE)?.value))) {
    return NextResponse.json({ error: "Operator mode required" }, { status: 401 });
  }
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const result = intent === "send" ? await approveAndSend(id) : intent === "reject" ? await reject(id, String(form.get("reason") ?? "")) : { ok: false, message: "Unknown action" };
  refreshDashboard();
  const url = new URL("/drafts", request.url);
  url.searchParams.set(result.ok ? "ok" : "err", result.message);
  url.hash = `o${id}`;
  return NextResponse.redirect(url, 303);
}
