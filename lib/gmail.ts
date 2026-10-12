import { db } from "./db";
import { decrypt, encrypt } from "./crypto";
import { env } from "./env";

/**
 * Minimal Gmail API client over fetch (scope: gmail.compose — drafts + send, nothing else).
 * The refresh token is stored AES-encrypted in the integrations table.
 */
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.compose";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export function redirectUri(origin: string) {
  return `${origin}/api/google/callback`;
}

export function authUrl(origin: string, state: string) {
  const p = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent", // always return a refresh token
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), ...body }),
    cache: "no-store",
  });
  const json = (await res.json()) as { access_token?: string; refresh_token?: string; scope?: string; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) throw new Error(`Google token error: ${json.error ?? res.status} ${json.error_description ?? ""}`.trim());
  return json;
}

export async function exchangeCode(code: string, origin: string) {
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri(origin) });
  if (!t.refresh_token) throw new Error("Google returned no refresh token; remove the app's access at myaccount.google.com/permissions and connect again");
  const profile = await gmailFetch<{ emailAddress: string }>("/profile", { accessToken: t.access_token! });
  await db()`
    insert into integrations (provider, account_email, refresh_token_enc, scopes, connected_at, last_ok_at, last_error)
    values ('gmail', ${profile.emailAddress}, ${encrypt(t.refresh_token)}, ${t.scope ?? GMAIL_SCOPE}, now(), now(), null)
    on conflict (provider) do update set account_email = excluded.account_email, refresh_token_enc = excluded.refresh_token_enc,
      scopes = excluded.scopes, connected_at = now(), last_ok_at = now(), last_error = null`;
  return profile.emailAddress;
}

let cached: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const [row] = await db()<{ refresh_token_enc: string | null }[]>`select refresh_token_enc from integrations where provider = 'gmail'`;
  if (!row?.refresh_token_enc) throw new GmailNotConnected();
  try {
    const t = await tokenRequest({ refresh_token: decrypt(row.refresh_token_enc), grant_type: "refresh_token" });
    cached = { token: t.access_token!, exp: Date.now() + 50 * 60_000 };
    return cached.token;
  } catch (e) {
    await db()`update integrations set last_error = ${(e as Error).message.slice(0, 300)} where provider = 'gmail'`;
    throw e;
  }
}

export class GmailNotConnected extends Error {
  constructor() { super("Gmail is not connected yet"); }
}

export class GmailApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function gmailFetch<T>(path: string, opts: { method?: string; body?: unknown; accessToken?: string } = {}): Promise<T> {
  const token = opts.accessToken ?? (await accessToken());
  const res = await fetch(`${API}${path}`, {
    method: opts.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, ...(opts.body ? { "Content-Type": "application/json" } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new GmailApiError(res.status, `Gmail ${res.status}: ${(json as { error?: { message?: string } }).error?.message ?? res.statusText}`);
  if (!opts.accessToken) await db()`update integrations set last_ok_at = now(), last_error = null where provider = 'gmail'`;
  return json as T;
}

function encodeHeader(v: string) {
  // RFC 2047 for non-ASCII subjects (₹, em dashes, Indian names).
  return /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`;
}

export function buildMime(m: { to: string; subject: string; body: string; outreachId: number }) {
  const lines = [
    `To: ${m.to}`,
    `Subject: ${encodeHeader(m.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    `X-Tandem-Forge-Outreach-Id: ${m.outreachId}`,
    "",
    Buffer.from(m.body, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n"),
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

export async function createDraft(m: { to: string; subject: string; body: string; outreachId: number }) {
  return gmailFetch<{ id: string; message: { id: string; threadId: string } }>("/drafts", {
    method: "POST",
    body: { message: { raw: buildMime(m) } },
  });
}

export async function sendDraft(draftId: string) {
  return gmailFetch<{ id: string; threadId: string; labelIds?: string[] }>("/drafts/send", { method: "POST", body: { id: draftId } });
}

export async function deleteDraft(draftId: string) {
  try {
    await gmailFetch(`/drafts/${draftId}`, { method: "DELETE" });
  } catch (e) {
    if (e instanceof GmailApiError && e.status === 404) return; // already gone
    throw e;
  }
}

/** null if the draft no longer exists in Gmail (sent or deleted by Rohit). */
export async function getDraft(draftId: string) {
  try {
    return await gmailFetch<{ id: string; message: { id: string } }>(`/drafts/${draftId}?format=minimal`);
  } catch (e) {
    if (e instanceof GmailApiError && e.status === 404) return null;
    throw e;
  }
}

export async function gmailStatus() {
  const [row] = await db()<{ account_email: string | null; connected_at: Date | null; last_ok_at: Date | null; last_error: string | null }[]>`
    select account_email, connected_at, last_ok_at, last_error from integrations where provider = 'gmail'`;
  return row ?? null;
}
