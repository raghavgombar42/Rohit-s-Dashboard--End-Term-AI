import { NextResponse, type NextRequest } from "next/server";
import { OPERATOR_COOKIE, isOperator } from "@/lib/auth";

// Pages are public and read-only. Side-effecting endpoints require operator mode.
// (Each route handler re-checks too — defence in depth.)
export async function proxy(request: NextRequest) {
  if (await isOperator(request.cookies.get(OPERATOR_COOKIE)?.value)) return NextResponse.next();
  return NextResponse.json({ error: "Operator mode required" }, { status: 401 });
}

export const config = {
  matcher: ["/api/actions/:path*", "/api/google/:path*"],
};
