import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { OPERATOR_COOKIE, isOperator } from "@/lib/auth";
import { authUrl } from "@/lib/gmail";

export const dynamic = "force-dynamic";

// Starts the Google OAuth flow (operator only). A random state is stored in a short-lived cookie
// and must come back unchanged on the callback (CSRF protection).
export async function GET(request: NextRequest) {
  if (!(await isOperator(request.cookies.get(OPERATOR_COOKIE)?.value))) {
    return NextResponse.json({ error: "Operator mode required" }, { status: 401 });
  }
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authUrl(request.nextUrl.origin, state));
  res.cookies.set("tfa_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
