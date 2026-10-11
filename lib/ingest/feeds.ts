import { XMLParser } from "fast-xml-parser";
import { stripHtml, stripPublisherSuffix, truncate } from "../text";

export type Source = { id: string; name: string; kind: "rss" | "google_news"; url: string };

export type FeedItem = {
  sourceId: string;
  url: string;
  title: string;
  publisher: string;
  publishedAt: Date | null;
  snippet: string | null;
  bodyText: string | null; // only when the feed ships full text (content:encoded)
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });

const UA = "Mozilla/5.0 (compatible; TandemForgeOutreachBot/1.0; +https://tandem-forge-outreach.vercel.app)";

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) return String((v as Record<string, unknown>)["#text"]);
  return "";
}

function parseDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function fetchFeed(source: Source, timeoutMs = 15000): Promise<FeedItem[]> {
  const res = await fetch(source.url, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  const doc = parser.parse(xml);
  const raw = doc?.rss?.channel?.item;
  if (raw === undefined) throw new Error("Not an RSS 2.0 feed (no channel.item)");
  const items: Record<string, unknown>[] = Array.isArray(raw) ? raw : [raw];

  return items
    .map((it): FeedItem | null => {
      const url = text(it.link).trim();
      const rawTitle = stripHtml(text(it.title));
      if (!url || !rawTitle) return null;
      // Google News: the real publisher lives in <source url="...">Name</source>.
      const publisher = source.kind === "google_news" ? text(it.source) || source.name : source.name;
      const title = source.kind === "google_news" ? stripPublisherSuffix(rawTitle, publisher) : rawTitle;
      const description = stripHtml(text(it.description));
      const encoded = stripHtml(text(it["content:encoded"]));
      return {
        sourceId: source.id,
        url,
        title,
        publisher,
        publishedAt: parseDate(text(it.pubDate)),
        // Google News descriptions only repeat the headline, so they carry no information.
        snippet: source.kind === "google_news" ? null : truncate(description, 1200),
        bodyText: encoded.length > 400 ? truncate(encoded, 20000) : null,
      };
    })
    .filter((x): x is FeedItem => x !== null);
}
