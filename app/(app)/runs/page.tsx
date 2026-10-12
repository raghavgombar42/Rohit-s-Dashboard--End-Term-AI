import { resilient } from "@/lib/db";
import Link from "next/link";
import { listRuns } from "@/lib/queries";
import { Badge, Card, Empty, PageHeader, RUN_TONE, duration, fmtDateTime } from "@/components/ui";
import { RunNowButton } from "@/components/run-button";

const TRIGGER_LABEL: Record<string, string> = {
  cron_hourly: "Hourly schedule",
  cron_daily: "Daily backup schedule",
  manual: "Run now (manual)",
  replay: "Historical replay",
};

export default async function RunsPage({ searchParams }: PageProps<"/runs">) {
  const sp = await searchParams;
  const runs = await resilient(() => listRuns(50));

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Pipeline runs"
        description="Each run fetches every live source, stores new articles once, and moves pending items forward. Only one run can be active at a time; a crashed run's work is picked up by the next one."
        actions={<RunNowButton />}
      />
      {sp.started === "1" && (
        <p className="mb-4 rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-sm text-info">
          Run started in the background. Refresh in a few seconds to see it here.
        </p>
      )}
      <Card flush>
        {runs.length === 0 ? (
          <div className="p-5"><Empty title="No runs yet">The hourly schedule will create the first run.</Empty></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-sunken/60 text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Run</th>
                  <th className="px-3 py-2.5 font-medium">Started</th>
                  <th className="px-3 py-2.5 font-medium">Duration</th>
                  <th className="px-3 py-2.5 font-medium text-right">Feeds OK</th>
                  <th className="px-3 py-2.5 font-medium text-right">Items seen</th>
                  <th className="px-3 py-2.5 font-medium text-right">New articles</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-background/60">
                    <td className="px-5 py-3">
                      <Link href={`/runs/${r.id}`} className="font-medium hover:text-accent">#{r.id}</Link>
                      <span className="ml-2 text-xs text-muted">{TRIGGER_LABEL[r.trigger] ?? r.trigger}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted">{fmtDateTime(r.started_at)}</td>
                    <td className="px-3 py-3 text-muted tabular-nums">{duration(r.started_at, r.finished_at)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {r.counts.feeds_ok ?? 0}
                      {r.counts.feeds_failed ? <span className="text-warn"> / {r.counts.feeds_failed} failed</span> : null}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.counts.items_seen ?? 0}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.counts.articles_new ?? 0}</td>
                    <td className="px-5 py-3"><Badge tone={RUN_TONE[r.status]} dot>{r.status}</Badge></td>
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
