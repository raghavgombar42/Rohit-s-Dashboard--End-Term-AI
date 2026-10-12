import Link from "next/link";
import { notFound } from "next/navigation";
import { runDetailData } from "@/lib/cached";
import { Badge, Card, PageHeader, RUN_TONE, duration, fmtDateTime } from "@/components/ui";

const COUNT_LABELS: Record<string, string> = {
  feeds_ok: "Feeds fetched",
  feeds_failed: "Feeds failed",
  items_seen: "Feed items seen",
  articles_new: "New articles stored",
  articles_syndicated_dupes: "Duplicate headlines",
  items_too_old: "Too old to matter",
  triage_funding: "AI: funding stories",
  triage_not_funding: "AI: not funding",
  articles_extracted: "Articles extracted",
  rounds_new: "New rounds passed rules",
  rounds_merged: "Merged into known round",
  rounds_gated_out: "Rounds filtered by rules",
  rounds_unverified: "Rounds failing quote check",
  extract_errors: "Extraction errors",
};

const LEVEL_TONE = { info: "neutral", warn: "warn", error: "bad" } as const;

export default async function RunDetailPage({ params }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n)) notFound();
  const data = await runDetailData(n);
  if (!data) notFound();
  const { run, events } = data;

  return (
    <div className="space-y-6">
      <Link href="/runs" className="text-xs text-muted hover:text-ink">← All runs</Link>
      <PageHeader
        eyebrow={`Run #${run.id} · ${run.trigger}`}
        title={fmtDateTime(run.started_at)}
        description={<>Took {duration(run.started_at, run.finished_at)} · <Badge tone={RUN_TONE[run.status]} dot>{run.status}</Badge></>}
      />
      {run.error && <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">{run.error}</p>}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(run.counts).map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line bg-surface px-4 py-3">
            <p className="text-xs text-muted">{COUNT_LABELS[k] ?? k}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <Card title="Event log" subtitle="Every step the run took, in order" flush>
        <ol className="divide-y divide-line border-t border-line">
          {events.map((e) => (
            <li key={e.id} className="flex gap-4 px-5 py-2.5 text-sm">
              <span className="w-24 shrink-0 text-xs text-faint tabular-nums">
                {new Date(e.created_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}
              </span>
              <span className="w-20 shrink-0"><Badge tone={LEVEL_TONE[e.level as keyof typeof LEVEL_TONE] ?? "neutral"}>{e.stage}</Badge></span>
              <span className={e.level === "error" ? "text-bad" : e.level === "warn" ? "text-warn" : ""}>{e.message}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
