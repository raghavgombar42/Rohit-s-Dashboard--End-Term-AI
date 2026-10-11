import Link from "next/link";
import { funnelCounts, listArticles, listRuns, overviewStats, sourceHealth } from "@/lib/queries";
import { loadActiveThesis } from "@/lib/thesis";
import { Badge, Card, Empty, PageHeader, RUN_TONE, Stat, fmtDate, fmtDateTime, timeAgo } from "@/components/ui";
import { ArticleStatus } from "@/components/article-status";
import { RunNowButton } from "@/components/run-button";

const FUNNEL_TONES = [
  "bg-sky-50 text-sky-900 ring-sky-100",
  "bg-violet-50 text-violet-900 ring-violet-100",
  "bg-amber-50 text-amber-900 ring-amber-100",
  "bg-emerald-50 text-emerald-900 ring-emerald-100",
  "bg-fuchsia-50 text-fuchsia-900 ring-fuchsia-100",
];

export default async function OverviewPage() {
  const [stats, runs, latest, sources, thesis, funnel] = await Promise.all([
    overviewStats(),
    listRuns(1),
    listArticles({ window: "all", view: "unique" }, 8),
    sourceHealth(),
    loadActiveThesis(),
    funnelCounts(),
  ]);
  const lastRun = runs[0];
  const live = sources.filter((s) => s.enabled);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={fmtDate(new Date())}
        title="Good morning, Rohit."
        description={
          <>
            The engine watches {live.length} live funding news sources every hour, keeps only fresh pre-seed and seed rounds
            that fit the Tandem Forge thesis, and leaves a researched draft in your Gmail.
          </>
        }
        actions={<RunNowButton />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat tone="violet" icon="★" label="Qualified startups" value={funnel.qualified} hint={<Link href="/qualified" className="text-accent hover:underline">Researched & scored →</Link>} />
        <Stat tone="sky" icon="◎" label="New articles · last 24h" value={stats.new_24h} hint={`${stats.total} ingested in total`} />
        <Stat tone="emerald" icon="✓" label="Rounds that passed the rules" value={funnel.rounds_pass} hint={`${funnel.rounds_fresh} fresh (≤ 24h) · rest are late catches`} />
        <Stat
          tone="amber"
          icon="↻"
          label="Last pipeline run"
          value={lastRun ? timeAgo(lastRun.started_at) : "—"}
          hint={lastRun ? <Badge tone={RUN_TONE[lastRun.status]} dot>{lastRun.status}</Badge> : "No runs yet"}
        />
      </div>

      <Card title="Today's funnel" subtitle="From raw news to startups worth contacting — every count is live">
        <ol className="grid gap-3 sm:grid-cols-5">
          {[
            ["Unique articles", funnel.articles, "/discoveries?window=all"],
            ["Funding stories (AI triage)", funnel.funding, "/discoveries?window=all"],
            ["Rounds filtered out by rules", funnel.filtered, "/rounds/filtered"],
            ["Rounds that passed the rules", funnel.rounds_pass, "/rounds"],
            ["Qualified on thesis fit", funnel.qualified, "/qualified"],
          ].map(([label, value, href], i) => (
            <li key={label as string}>
              <Link href={href as string} className={`block rounded-xl px-4 py-3 ring-1 ring-inset transition hover:-translate-y-0.5 ${FUNNEL_TONES[i]}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">Step {i + 1}</p>
                <p className="mt-1 font-display text-3xl tabular-nums">{value as number}</p>
                <p className="text-xs text-muted">{label as string}</p>
              </Link>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card
            title="Latest discoveries"
            subtitle="Newest unique articles from all sources"
            right={<Link href="/discoveries" className="text-xs font-medium text-accent hover:underline">See all →</Link>}
            flush
          >
            {latest.length === 0 ? (
              <div className="px-5 pb-5"><Empty title="Nothing discovered yet">Run the pipeline to pull the latest funding news.</Empty></div>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {latest.map((a) => (
                  <li key={a.id} className="px-5 py-3">
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-sm font-medium leading-snug hover:text-accent">
                      {a.title}
                    </a>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{a.publisher}</span>
                      <span className="text-faint">·</span>
                      <span>{timeAgo(a.published_at ?? a.first_seen_at)}</span>
                      <ArticleStatus status={a.status} rejectReason={a.reject_reason} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Active thesis"
            subtitle={`Version ${thesis.version} · edited ${fmtDateTime(thesis.updated_at)}`}
            right={<Link href="/thesis" className="text-xs font-medium text-accent hover:underline">Open →</Link>}
          >
            <p className="text-sm leading-relaxed">{thesis.summary}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {thesis.stages.map((s) => <Badge key={s} tone="accent">{s.replace("_", "-")}</Badge>)}
              {thesis.geographies.map((g) => <Badge key={g}>{g}</Badge>)}
              <Badge tone="info">qualify ≥ {thesis.threshold}</Badge>
            </div>
          </Card>

          <Card title="Source health" subtitle="Articles stored per feed" flush>
            <ul className="divide-y divide-line border-t border-line text-sm">
              {sources.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-2">
                  <span className={s.enabled ? "" : "text-faint line-through"}>{s.name}</span>
                  <span className="flex items-center gap-2 text-xs text-muted tabular-nums">
                    {s.enabled ? <>{s.total}<span className="text-faint">· +{s.last_24h} today</span></> : <Badge>disabled</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
