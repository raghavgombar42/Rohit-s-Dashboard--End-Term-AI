// The dashboard is public and read-only. Only actions with side effects (run the pipeline,
// approve/send/reject drafts, connect Gmail) need "operator mode": a passcode that sets a
// cookie holding an HMAC of the passcode. Changing OPERATOR_PASSCODE revokes every session.
// Web Crypto only, so this also runs inside proxy.ts.
export const OPERATOR_COOKIE = "tfa_operator";

async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function operatorToken(): Promise<string> {
  const code = process.env.OPERATOR_PASSCODE;
  if (!code) throw new Error("Missing environment variable OPERATOR_PASSCODE");
  return hmacHex(code, "tandem-forge-operator-v1");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isOperator(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  return safeEqual(cookieValue, await operatorToken());
}

// Bearer secret for machine callers (Supabase pg_cron, Vercel cron).
export function isValidCronAuth(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  return safeEqual(header, `Bearer ${secret}`);
}
