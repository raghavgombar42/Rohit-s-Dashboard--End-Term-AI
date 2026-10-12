import { resilient } from "@/lib/db";
import { listAssessed, listFilteredOut } from "@/lib/queries";
import { humanReason } from "@/lib/labels";
import { loadActiveThesis } from "@/lib/thesis";
import { Badge, Card, Empty, PageHeader, timeAgo } from "@/components/ui";
import { RoundTabs } from "@/components/round-tabs";
import { CriteriaBars, ScoreRing } from "@/components/assessment";

export default async function FilteredPage() {
  const [rows, notFit, thesis] = await resilient(() => Promise.all([listFilteredOut(), listAssessed(false), loadActiveThesis()]));

  return (
    <div>
      <PageHeader
        eyebrow="Audit trail"
        title="Filtered out"
        description="Everything the engine decided against, with the exact reason. Rohit never needs this view; it exists so every decision can be explained and challenged."
      />
      <RoundTabs active="filtered" />

      <h2 className="mb-1 text-sm font-semibold">Researched, but not a thesis fit <span className="text-muted">({notFit.length})</span></h2>
      <p className="mb-3 text-xs text-muted">Scored below {thesis.threshold}/100 or matched an excluded sector. Score breakdown inside each row.</p>
      <div className="mb-10 space-y-3">
        {notFit.length === 0 ? (
          <Empty title="No researched startup has been ruled out yet" />
        ) : (
          notFit.map((a) => (
            <details key={a.id} className="group rounded-2xl border border-line bg-surface px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center gap-4">
                <ScoreRing score={Number(a.total)} threshold={thesis.threshold} size={52} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.name} <span className="text-xs font-normal text-muted">· {a.criteria_scores._meta?.primary_sector}</span></p>
                  <p className="truncate text-xs text-muted">{a.summary}</p>
                </div>
                <div className="hidden flex-wrap gap-1.5 sm:flex">
                  {a.gate_failures.length > 0
                    ? a.gate_failures.map((g) => <Badge key={g} tone="bad">{g.replace("excluded_sector:", "Excluded: ")}</Badge>)
                    : <Badge tone="warn">Below {thesis.threshold}</Badge>}
                </div>
              </summary>
              <div className="mt-4 border-t border-line pt-4"><CriteriaBars a={a} /></div>
            </details>
          ))
        )}
      </div>

      <h2 className="mb-1 text-sm font-semibold">Rejected by the hard rules <span className="text-muted">({rows.length})</span></h2>
      <p className="mb-3 text-xs text-muted">Wrong stage, outside India, old news or outside the outreach window. Decided by code before any research.</p>
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
