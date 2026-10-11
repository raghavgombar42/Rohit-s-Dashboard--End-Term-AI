import { NextResponse, type NextRequest } from "next/server";
import { OPERATOR_COOKIE, operatorToken, safeEqual } from "@/lib/auth";

// Send the user back to the page they came from (same-origin Referer), never to another site.
function backTo(request: NextRequest, query = ""): URL {
  let path = "/";
  const ref = request.headers.get("referer");
  if (ref) {
    try {
      const u = new URL(ref);
      if (u.origin === request.nextUrl.origin) {
        u.searchParams.delete("operator");
        path = u.pathname + u.search;
      }
    } catch {}
  }
  const url = new URL(path, request.url);
  if (query) url.searchParams.set("operator", query);
  return url;
}

// POST with intent=unlock|lock. Unlock sets the operator cookie; lock clears it.
export async function POST(request: NextRequest) {
  const form = await request.formData();

  if (String(form.get("intent")) === "lock") {
    const res = NextResponse.redirect(backTo(request), 303);
    res.cookies.delete(OPERATOR_COOKIE);
    return res;
  }

  const expected = process.env.OPERATOR_PASSCODE ?? "";
  const given = String(form.get("passcode") ?? "");
  if (!expected || !safeEqual(given, expected)) {
    return NextResponse.redirect(backTo(request, "denied"), 303);
  }
  const res = NextResponse.redirect(backTo(request), 303);
  res.cookies.set(OPERATOR_COOKIE, await operatorToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
