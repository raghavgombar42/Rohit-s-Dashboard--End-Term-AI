import { NextResponse, type NextRequest } from "next/server";
import { OPERATOR_COOKIE, isOperator, safeEqual } from "@/lib/auth";
import { exchangeCode } from "@/lib/gmail";
import { refreshDashboard } from "@/lib/refresh";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/setup?${q}`, request.url), 303);
  if (!(await isOperator(request.cookies.get(OPERATOR_COOKIE)?.value))) return back("gmail=denied");

  const sp = request.nextUrl.searchParams;
  if (sp.get("error")) return back(`gmail=error&reason=${encodeURIComponent(sp.get("error")!)}`);
  const state = sp.get("state") ?? "";
  const expected = request.cookies.get("tfa_oauth_state")?.value ?? "";
  if (!expected || !safeEqual(state, expected)) return back("gmail=error&reason=state_mismatch");

  try {
    const email = await exchangeCode(sp.get("code") ?? "", request.nextUrl.origin);
    refreshDashboard();
    const res = back(`gmail=connected&as=${encodeURIComponent(email)}`);
    res.cookies.delete("tfa_oauth_state");
    return res;
  } catch (e) {
    return back(`gmail=error&reason=${encodeURIComponent((e as Error).message.slice(0, 200))}`);
  }
}
