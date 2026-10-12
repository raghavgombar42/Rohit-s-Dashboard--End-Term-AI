import { fetchPage } from "../research/web";

/**
 * Contact discovery without guessing: only email addresses PUBLISHED on the startup's own website
 * (or in the source articles) that belong to the startup's own domain. No pattern-guessing
 * (firstname@domain), no scraped personal data from third-party sites.
 */

export type Contact = {
  email: string;
  name: string | null;
  source: "website" | "article";
  status: "published_on_site" | "published_in_article";
  rank: number;
};

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const BAD_LOCAL = /^(no-?reply|donotreply|privacy|legal|grievance|careers?|jobs|hr|abuse|compliance|dpo|nodal|unsubscribe|press|media|investor|billing|accounts|example)/i;
const GOOD_LOCAL: [RegExp, number][] = [
  [/^(founders?|ceo|cofounders?)$/i, 3],
  [/^(hello|hi|contact|team|connect|partnerships?|partners|business|info)$/i, 2],
  [/^(support|care|help|customercare|cs)$/i, 1],
];

export function rankEmails(candidates: string[], domain: string, founders: { name: string }[]): Contact[] {
  const base = domain.replace(/^www\./, "");
  const firstNames = founders.map((f) => f.name.split(/\s+/)[0].toLowerCase()).filter((n) => n.length > 1);
  const seen = new Set<string>();
  const out: Contact[] = [];
  for (const raw of candidates) {
    const email = raw.toLowerCase().replace(/^mailto:/, "").replace(/[.,;:]+$/, "");
    const [local, host] = email.split("@");
    if (!host || seen.has(email)) continue;
    seen.add(email);
    if (!(host === base || host.endsWith(`.${base}`))) continue; // only the startup's own domain
    if (BAD_LOCAL.test(local) || /\.(png|jpg|jpeg|svg|webp|gif)$/.test(email)) continue;
    const founderMatch = firstNames.find((n) => local === n || local.startsWith(`${n}.`) || local.startsWith(n));
    const rank = founderMatch ? 4 : GOOD_LOCAL.find(([re]) => re.test(local))?.[1] ?? 0.5;
    const founder = founderMatch ? founders.find((f) => f.name.toLowerCase().startsWith(founderMatch)) : undefined;
    out.push({ email, name: founder?.name ?? null, source: "website", status: "published_on_site", rank });
  }
  return out.sort((a, b) => b.rank - a.rank);
}

export async function findContact(website: string | null, domain: string | null, founders: { name: string }[], articleTexts: string[]): Promise<Contact | null> {
  if (!domain) return null;
  const found: string[] = [];
  if (website) {
    const origin = new URL(website).origin;
    const pages = await Promise.all([origin, `${origin}/contact`, `${origin}/contact-us`, `${origin}/about`].map((u) => fetchPage(u)));
    for (const p of pages) {
      if (!p) continue;
      for (const m of p.html.matchAll(/mailto:([^"'?>\s]+)/gi)) found.push(decodeURIComponent(m[1]));
      for (const m of p.text.matchAll(EMAIL_RE)) found.push(m[0]);
    }
  }
  const fromSite = rankEmails(found, domain, founders);
  if (fromSite.length) return fromSite[0];
  const fromArticles = rankEmails(articleTexts.flatMap((t) => t.match(EMAIL_RE) ?? []), domain, founders);
  return fromArticles[0] ? { ...fromArticles[0], source: "article", status: "published_in_article" } : null;
}

// ---------- Hunter.io (optional): a credible third-party index of public business emails ----------

type HunterEmail = { value: string; type: "personal" | "generic"; confidence: number; first_name: string | null; position: string | null };

export type HunterContact = Omit<Contact, "source" | "status"> & {
  source: "hunter";
  status: "hunter_verified" | "hunter_unverified";
  confidence: number;
};

/** Used only when the startup's own site gives no founder-level address. Founder name match is required for personal emails. */
export async function hunterContact(domain: string, founders: { name: string }[]): Promise<HunterContact | null> {
  const key = process.env.HUNTER_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=10&api_key=${key}`, {
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Hunter domain-search ${res.status}`);
  const emails = ((await res.json()) as { data?: { emails?: HunterEmail[] } }).data?.emails ?? [];

  const firstNames = founders.map((f) => f.name.split(/\s+/)[0].toLowerCase()).filter((n) => n.length > 1);
  const founderHit = emails
    .filter((e) => e.type === "personal")
    .map((e) => {
      const local = e.value.split("@")[0].toLowerCase();
      const match = firstNames.find((n) => (e.first_name ?? "").toLowerCase() === n || local === n || local.startsWith(`${n}.`) || local.startsWith(n));
      return match ? { e, founder: founders.find((f) => f.name.toLowerCase().startsWith(match)) } : null;
    })
    .filter((x): x is { e: HunterEmail; founder: { name: string } | undefined } => x !== null)
    .sort((a, b) => b.e.confidence - a.e.confidence)[0];

  const pick = founderHit
    ? { email: founderHit.e.value.toLowerCase(), name: founderHit.founder?.name ?? null, rank: 4, confidence: founderHit.e.confidence }
    : (() => {
        const g = rankEmails(emails.filter((e) => e.type === "generic").map((e) => e.value), domain, founders)[0];
        const conf = g ? emails.find((e) => e.value.toLowerCase() === g.email)?.confidence ?? 0 : 0;
        return g ? { email: g.email, name: null, rank: g.rank, confidence: conf } : null;
      })();
  if (!pick) return null;

  // Verify deliverability (one verification credit). Unverifiable addresses are kept but labelled.
  let status: HunterContact["status"] = "hunter_unverified";
  try {
    const v = await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(pick.email)}&api_key=${key}`, { signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (v.ok && ((await v.json()) as { data?: { result?: string; status?: string } }).data?.status === "valid") status = "hunter_verified";
  } catch {
    /* keep unverified */
  }
  return { ...pick, source: "hunter", status };
}
