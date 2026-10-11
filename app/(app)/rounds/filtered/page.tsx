import { listFilteredOut } from "@/lib/queries";
import { humanReason } from "@/lib/labels";
import { Badge, Card, Empty, PageHeader, timeAgo } from "@/components/ui";
import { RoundTabs } from "@/components/round-tabs";

export default async function FilteredPage() {
  const rows = await listFilteredOut();

  return (
    <div>
      <PageHeader
        eyebrow="Audit trail"
        title="Filtered out"
        description="Every round the hard rules rejected, with the exact reason. Rohit never needs this view; it exists so any decision can be explained and challenged."
      />
      <RoundTabs active="filtered" />
      <Card flush>
        {rows.length === 0 ? (
          <div className="p-5"><Empty title="Nothing filtered out yet" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-sunken/60 text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Startup</th>
                  <th className="px-3 py-2.5 font-medium">Why it was filtered out</th>
                  <th className="px-5 py-2.5 font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r, i) => (
                  <tr key={`${r.article_id}-${i}`} className="align-top">
                    <td className="whitespace-nowrap px-5 py-3 font-medium">{r.startup}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {r.outcome.replace("rejected:", "").split(",").map((c) => <Badge key={c} tone="warn">{humanReason(c)}</Badge>)}
                      </div>
                      {r.notes?.map((n) => <p key={n} className="mt-1 text-xs text-faint">{n}</p>)}
                    </td>
                    <td className="min-w-[14rem] px-5 py-3">
                      <a href={r.url} target="_blank" rel="noreferrer" className="text-xs leading-snug hover:text-accent">{r.title}</a>
                      <p className="text-[11px] text-faint">{r.publisher} · {timeAgo(r.published_at)}</p>
                    </td>
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
