import Link from "next/link";
import { funnelCounts, listArticles, listOutreach, listRuns, sourceHealth } from "@/lib/queries";
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
  "bg-indigo-50 text-indigo-900 ring-indigo-100",
];

// The whole product in one line each. "who" says whether AI or code does the step.
const HOW = [
  { n: 1, title: "Discover", who: "code", text: "9 live funding-news feeds, every hour" },
  { n: 2, title: "Spot funding news", who: "AI", text: "Gemini triages every headline" },
  { n: 3, title: "Extract & verify", who: "AI + code", text: "Facts need a verbatim quote; code checks stage, India, recency" },
  { n: 4, title: "Research & score", who: "AI + code", text: "Brief from real sources; thesis from Supabase; code decides" },
  { n: 5, title: "Draft", who: "AI + code", text: "Personal email from verified facts, checked, into Gmail" },
  { n: 6, title: "You approve", who: "Rohit", text: "Send or reject. Never twice, never automatic" },
];
const WHO_TONE = { code: "bg-indigo-100 text-indigo-700", AI: "bg-fuchsia-100 text-fuchsia-700", "AI + code": "bg-violet-100 text-violet-700", Rohit: "bg-amber-100 text-amber-800" } as const;

export default async function OverviewPage() {
  const [runs, latest, sources, thesis, funnel, outreach] = await Promise.all([
    listRuns(1),
    listArticles({ window: "all", view: "unique" }, 6),
    sourceHealth(),
    loadActiveThesis(),
    funnelCounts(),
    listOutreach(),
  ]);
  const lastRun = runs[0];
  const live = sources.filter((s) => s.enabled);
  const waiting = outreach.filter((o) => o.status === "drafted_gmail" || o.status === "drafted_db");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={fmtDate(new Date())}
        title="Good morning, Rohit."
        description={
          <>
            {waiting.length > 0 ? (
              <>You have <strong className="text-ink">{waiting.length} researched draft{waiting.length === 1 ? "" : "s"}</strong> waiting in Gmail. </>
            ) : (
              <>No new drafts right now. </>
            )}
            The engine watches {live.length} live funding-news sources every hour and only drafts for fresh pre-seed and seed rounds that fit the
            Tandem Forge thesis.
          </>
        }
        actions={<RunNowButton />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat tone="violet" icon="✉" label="Drafts waiting for you" value={waiting.length} hint={<Link href="/drafts" className="text-accent hover:underline">Review drafts →</Link>} />
        <Stat tone="emerald" icon="★" label="Qualified startups" value={funnel.qualified} hint={<Link href="/qualified" className="text-accent hover:underline">Research & scores →</Link>} />
        <Stat tone="sky" icon="◎" label="Rounds that passed the rules" value={funnel.rounds_pass} hint={`${funnel.rounds_fresh} fresh (≤ 24h) · the rest are late catches`} />
        <Stat
          tone="amber"
          icon="↻"
          label="Last pipeline run"
          value={lastRun ? timeAgo(lastRun.started_at) : "—"}
          hint={lastRun ? <Badge tone={RUN_TONE[lastRun.status]} dot>{lastRun.status}</Badge> : "No runs yet"}
        />
      </div>

      <Card
        title="Ready for you"
        subtitle="Drafts already sitting in Rohit's Gmail, best fit first"
        right={<Link href="/drafts" className="text-xs font-medium text-accent hover:underline">All drafts →</Link>}
        flush
      >
        {waiting.length === 0 ? (
          <div className="px-5 pb-5">
            <Empty title="No drafts waiting">When the hourly run finds a fresh round that fits the thesis, a draft appears here and in Gmail.</Empty>
          </div>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {[...waiting].sort((a, b) => Number(b.total) - Number(a.total)).slice(0, 4).map((o) => (
              <li key={o.id}>
                <Link href={`/drafts#o${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-background/70">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-semibold text-white">
                    {Math.round(Number(o.total))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{o.startup}</span>
                    <span className="block truncate text-xs text-muted">{o.subject.replace(/^\[TEST → [^\]]*\]\s*/, "")}</span>
                  </span>
                  <span className="text-xs text-muted">{o.intended_to ?? "no verified contact"}</span>
                  <Badge tone={o.recency_lane === "fresh" ? "good" : "warn"} dot>{o.recency_lane === "fresh" ? "Fresh" : "Late catch"}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {HOW.map((s) => (
            <li key={s.n} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-xs font-semibold text-white">{s.n}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${WHO_TONE[s.who as keyof typeof WHO_TONE]}`}>{s.who}</span>
              </div>
              <p className="mt-3 text-sm font-semibold">{s.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <Card title="Today's funnel" subtitle="From raw news to emails in Gmail. Every count is live">
        <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Unique articles", funnel.articles, "/discoveries?window=all"],
            ["Funding stories (AI)", funnel.funding, "/discoveries?window=all"],
            ["Filtered out by rules", funnel.filtered, "/rounds/filtered"],
            ["Passed the rules", funnel.rounds_pass, "/rounds"],
            ["Qualified on thesis", funnel.qualified, "/qualified"],
            ["Drafts written", funnel.drafted, "/drafts"],
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
