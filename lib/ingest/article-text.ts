import { stripHtml, truncate } from "../text";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/**
 * Best-effort article body extraction from a publisher page: prefer <article>, fall back to
 * all substantial <p> paragraphs. Returns null rather than guessing when the page is unusable.
 * Google News links are JavaScript redirects and are never fetched.
 */
export async function fetchArticleText(url: string, timeoutMs = 12000): Promise<string | null> {
  if (/^https?:\/\/news\.google\.com\//.test(url)) return null;
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
    html = await res.text();
  } catch {
    return null;
  }
  html = html.replace(/<(script|style|noscript|svg|nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, " ");

  const article = html.match(/<article[\s\S]*?<\/article>/i)?.[0];
  const scope = article && stripHtml(article).length > 600 ? article : html;
  const paragraphs = [...scope.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripHtml(m[1]))
    .filter((p) => p.length > 40 && !/cookie|subscribe|newsletter|all rights reserved/i.test(p));
  const text = paragraphs.join("\n");
  return text.length > 300 ? truncate(text, 20000) : null;
}
