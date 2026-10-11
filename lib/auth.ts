// Single-user password gate. The session cookie holds an HMAC of the password, so changing
// DASHBOARD_PASSWORD invalidates every existing session. Web Crypto only, so it runs in proxy.ts.
export const SESSION_COOKIE = "tfa_session";

async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sessionToken(): Promise<string> {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) throw new Error("Missing environment variable DASHBOARD_PASSWORD");
  return hmacHex(pw, "tandem-forge-session-v1");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  return safeEqual(cookieValue, await sessionToken());
}

// Bearer secret for machine callers (pg_cron, Vercel cron).
export function isValidCronAuth(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  return safeEqual(header, `Bearer ${secret}`);
}
