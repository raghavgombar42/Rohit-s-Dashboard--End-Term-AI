import { decodeEntities, normalizeCompanyName, stripHtml, truncate } from "../text";
import { domainOf } from "../funding/verify";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export type FetchedPage = { url: string; title: string; text: string; html: string };

/** Fetch a page and return its visible text (whole body, not just <p>; startup sites use divs). */
export async function fetchPage(url: string, timeoutMs = 10000): Promise<FetchedPage | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
    const html = (await res.text()).slice(0, 1_500_000);
    const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
    const meta = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? "";
    const body = stripHtml(html.replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " "));
    const text = truncate([title, decodeEntities(meta), body].filter(Boolean).join("\n"), 8000) ?? "";
    return { url: res.url || url, title, text, html };
  } catch {
    return null;
  }
}

/**
 * Deterministic website verification: the page must load and the startup's name must appear in
 * its title/text or domain. This is how an AI-proposed URL earns trust.
 */
export function pageMatchesStartup(page: FetchedPage, startupName: string): boolean {
  const target = normalizeCompanyName(startupName);
  if (target.length < 3) return false;
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const domain = domainOf(page.url) ?? "";
  return squash(page.title).includes(target) || squash(page.text.slice(0, 4000)).includes(target) || squash(domain).includes(target);
}

/** Homepage + common About pages, best effort, de-duplicated. */
export async function fetchCompanyPages(website: string): Promise<FetchedPage[]> {
  const base = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
  const candidates = [base.origin, `${base.origin}/about`, `${base.origin}/about-us`];
  const pages = await Promise.all(candidates.map((u) => fetchPage(u)));
  const seen = new Set<string>();
  return pages.filter((p): p is FetchedPage => {
    if (!p || p.text.length < 200) return false;
    const key = p.text.slice(0, 300);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
