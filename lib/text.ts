import { createHash } from "node:crypto";

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…", rupee: "₹",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|figure|figcaption)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$|cmpid$|from$|source$|oc$)/i;

/** Canonical form used for article-level dedup: lowercase host without www, no tracking params, no fragment, no trailing slash. */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    if (u.hostname === "news.google.com") u.search = "";
    for (const key of [...u.searchParams.keys()]) if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s.replace(/^http:/, "https:");
  } catch {
    return raw.trim();
  }
}

/** Removes a trailing " - Publisher" (Google News titles) and normalises for comparison. */
export function stripPublisherSuffix(title: string, publisher?: string | null): string {
  if (publisher) {
    const suffix = ` - ${publisher}`;
    if (title.endsWith(suffix)) return title.slice(0, -suffix.length);
  }
  return title;
}

export function normalizeTitle(title: string): string {
  return decodeEntities(title)
    .toLowerCase()
    .replace(/[’'`"“”]/g, "")
    .replace(/[^a-z0-9₹$]+/g, " ")
    .trim();
}

export function titleHash(title: string): string {
  return createHash("sha256").update(normalizeTitle(title)).digest("hex").slice(0, 32);
}

/** Company-name normalisation for identity resolution (used from M4). */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(private|pvt|limited|ltd|llp|inc|technologies|technology|tech|labs|india)\b\.?/g, " ")
    .replace(/\.(ai|io|in|com|co)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function truncate(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}
