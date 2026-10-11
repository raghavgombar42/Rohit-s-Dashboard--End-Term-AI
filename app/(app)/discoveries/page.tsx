import Link from "next/link";
import { listArticles, type DiscoveryFilter } from "@/lib/queries";
import { Card, Empty, PageHeader, fmtDateTime, timeAgo } from "@/components/ui";
import { ArticleStatus } from "@/components/article-status";

const WINDOWS = [["24h", "Last 24 hours"], ["7d", "Last 7 days"], ["all", "All"]] as const;
const VIEWS = [["unique", "Unique stories"], ["duplicates", "Duplicates caught"], ["all", "Everything"]] as const;

function pick<T extends string>(v: unknown, allowed: readonly (readonly [T, string])[], fallback: T): T {
  return allowed.some(([k]) => k === v) ? (v as T) : fallback;
}

export default async function DiscoveriesPage({ searchParams }: PageProps<"/discoveries">) {
  const sp = await searchParams;
  const f: DiscoveryFilter = { window: pick(sp.window, WINDOWS, "24h"), view: pick(sp.view, VIEWS, "unique") };
  const rows = await listArticles(f);
  const href = (patch: Partial<DiscoveryFilter>) => `/discoveries?${new URLSearchParams({ ...f, ...patch })}`;

  return (
    <div>
      <PageHeader
        eyebrow="Step 1 · Discovery"
        title="Discoveries"
        description="Every article the engine pulled from live sources, with its publisher and publication time. Duplicate headlines are kept as extra sources but never sent to the AI twice."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {WINDOWS.map(([k, label]) => (
          <Link key={k} href={href({ window: k })} className={`rounded-full px-3 py-1.5 text-xs font-medium ${f.window === k ? "bg-accent text-white shadow-sm shadow-violet-500/30" : "border border-line bg-surface text-muted hover:text-ink"}`}>{label}</Link>
        ))}
        <span className="mx-2 h-4 w-px bg-line" />
        {VIEWS.map(([k, label]) => (
          <Link key={k} href={href({ view: k })} className={`rounded-full px-3 py-1.5 text-xs font-medium ${f.view === k ? "bg-accent text-white shadow-sm shadow-violet-500/30" : "border border-line bg-surface text-muted hover:text-ink"}`}>{label}</Link>
        ))}
        <span className="ml-auto text-xs text-muted">{rows.length} article{rows.length === 1 ? "" : "s"}</span>
      </div>

      <Card flush>
        {rows.length === 0 ? (
          <div className="p-5">
            <Empty title="No articles in this window">
              Nothing matched. If the last 24 hours are quiet, widen the window. The engine never fills gaps with sample data.
            </Empty>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-sunken/60 text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Headline</th>
                  <th className="hidden px-3 py-2.5 font-medium md:table-cell">Publisher</th>
                  <th className="px-3 py-2.5 font-medium">Published</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((a) => (
                  <tr key={a.id} className="align-top hover:bg-background/60">
                    <td className="min-w-[15rem] max-w-xl px-5 py-3">
                      <a href={a.url} target="_blank" rel="noreferrer" className="font-medium leading-snug hover:text-accent">{a.title}</a>
                      <p className="mt-0.5 text-xs text-faint"><span className="md:hidden">{a.publisher} · </span>via {a.source_name}</p>
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-3 text-muted md:table-cell">{a.publisher}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted" title={fmtDateTime(a.published_at)}>
                      {a.published_at ? timeAgo(a.published_at) : <span className="text-faint">not stated</span>}
                    </td>
                    <td className="px-5 py-3"><ArticleStatus status={a.status} rejectReason={a.reject_reason} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
