import { resilient } from "@/lib/db";
import Link from "next/link";
import { dailyNews, funnelCounts, listArticles, listOutreach, listRuns, newsHeatmap, roundOutcomes, sourceHealth } from "@/lib/queries";
import { loadActiveThesis } from "@/lib/thesis";
import { Badge, Card, Empty, RUN_TONE, Stat, fmtDate, fmtDateTime, timeAgo } from "@/components/ui";
import { ArticleStatus } from "@/components/article-status";
import { RunNowButton } from "@/components/run-button";
import { NewsBars, NewsHeatmap, OutcomeDonut } from "@/components/charts";
import { CountUp } from "@/components/count-up";

const FUNNEL_TONES = [
  "from-sky-500/20 to-sky-500/5 text-sky-100 ring-sky-400/20",
  "from-indigo-500/20 to-indigo-500/5 text-indigo-100 ring-indigo-400/20",
  "from-amber-500/20 to-amber-500/5 text-amber-100 ring-amber-400/20",
  "from-violet-500/20 to-violet-500/5 text-violet-100 ring-violet-400/20",
  "from-fuchsia-500/20 to-fuchsia-500/5 text-fuchsia-100 ring-fuchsia-400/20",
  "from-lime-400/20 to-lime-400/5 text-lime-100 ring-lime-300/25",
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
const WHO_TONE = { code: "bg-indigo-500/20 text-indigo-200", AI: "bg-fuchsia-500/20 text-fuchsia-200", "AI + code": "bg-violet-500/20 text-violet-200", Rohit: "bg-amber-400/20 text-amber-200" } as const;

function greeting() {
  const h = Number(new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function OverviewPage() {
  const [runs, latest, sources, thesis, funnel, outreach, daily, outcomes, heat] = await resilient(() => Promise.all([
    listRuns(1),
    listArticles({ window: "all", view: "unique" }, 6),
    sourceHealth(),
    loadActiveThesis(),
    funnelCounts(),
    listOutreach(),
    dailyNews(14),
    roundOutcomes(),
    newsHeatmap(),
  ]));
  const lastRun = runs[0];
  const live = sources.filter((s) => s.enabled);
  const waiting = outreach.filter((o) => o.status === "drafted_gmail" || o.status === "drafted_db");
  const news14 = daily.reduce((s, d) => s + d.articles, 0);
  const funding14 = daily.reduce((s, d) => s + d.funding, 0);

  return (
    <div className="space-y-6">
      {/* Hero — Loud-style oversized greeting */}
      <section className="rise flex flex-wrap items-end justify-between gap-6 pb-2">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">{fmtDate(new Date())}</p>
          <h1 className="mt-2 text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
            {greeting()}, <span className="text-faint">Rohit</span>
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            {waiting.length > 0 ? (
              <>
                <span className="text-gradient font-semibold">{waiting.length} researched draft{waiting.length === 1 ? "" : "s"}</span> waiting in your Gmail.{" "}
              </>
            ) : (
              <>No new drafts right now. </>
            )}
            The engine watches {live.length} live funding-news sources every hour and only drafts for fresh pre-seed and seed rounds that fit
            the Tandem Forge thesis.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRun && (
            <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-muted ring-1 ring-white/[0.06]">
              <span className={`pulse-dot h-2 w-2 rounded-full ${lastRun.status === "running" ? "bg-sky-300 text-sky-300" : "bg-lime-300 text-lime-300"}`} />
              {lastRun.status === "running" ? "Pipeline running now" : `Last run ${timeAgo(lastRun.started_at)}`}
            </span>
          )}
          <RunNowButton />
        </div>
      </section>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat tone="violet" icon="✉" label="Drafts waiting for you" value={waiting.length} hint={<Link href="/drafts" className="text-violet-300 hover:underline">Review drafts →</Link>} />
        <Stat tone="emerald" icon="★" label="Qualified startups" value={funnel.qualified} hint={<Link href="/qualified" className="text-lime-300 hover:underline">Research & scores →</Link>} />
        <Stat tone="sky" icon="◎" label="Rounds that passed the rules" value={funnel.rounds_pass} hint={`${funnel.rounds_fresh} fresh (≤ 24h) · the rest are late catches`} />
        <Stat
          tone="amber"
          icon="↻"
          label="Pipeline health"
          value={lastRun ? timeAgo(lastRun.started_at) : "—"}
          hint={lastRun ? <Badge tone={RUN_TONE[lastRun.status]} dot>last run {lastRun.status}</Badge> : "No runs yet"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            title="Ready for you"
            subtitle="Drafts already sitting in Rohit's Gmail, best fit first"
            right={<Link href="/drafts" className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-medium text-ink ring-1 ring-white/10 hover:bg-white/10">All drafts →</Link>}
            flush
          >
            {waiting.length === 0 ? (
              <div className="px-5 pb-5">
                <Empty title="No drafts waiting">When the hourly run finds a fresh round that fits the thesis, a draft appears here and in Gmail.</Empty>
              </div>
            ) : (
              <ul className="stagger divide-y divide-white/[0.06] border-t border-white/[0.06]">
                {[...waiting].sort((a, b) => Number(b.total) - Number(a.total)).slice(0, 5).map((o) => (
                  <li key={o.id}>
                    <Link href={`/drafts#o${o.id}`} className="group flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 transition hover:bg-white/[0.03]">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-semibold text-white shadow-lg shadow-violet-900/40">
                        {Math.round(Number(o.total))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{o.startup}</span>
                        <span className="block truncate text-xs text-muted">{o.subject.replace(/^\[TEST → [^\]]*\]\s*/, "")}</span>
                      </span>
                      <span className="hidden text-xs text-muted sm:inline">{o.intended_to ?? "no verified contact"}</span>
                      <Badge tone={o.recency_lane === "fresh" ? "good" : "warn"} dot>{o.recency_lane === "fresh" ? "Fresh" : "Late catch"}</Badge>
                      <span className="text-faint transition group-hover:translate-x-0.5 group-hover:text-ink">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card title="What happened to every round" subtitle="Each funding round Gemini extracted, by outcome">
          <OutcomeDonut data={outcomes} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            title="Funding news, last 14 days"
            subtitle={<>Unique articles per day (IST); <span className="text-violet-300">coloured part = funding stories</span> · {news14} articles, {funding14} funding</>}
          >
            <NewsBars data={daily} />
          </Card>
        </div>
        <Card title="When funding news breaks" subtitle="Funding stories by day and time (IST)">
          <NewsHeatmap data={heat} />
        </Card>
      </div>

      <section className="rise">
        <h2 className="mb-3 text-sm font-semibold">How it works</h2>
        <ol className="stagger grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {HOW.map((s) => (
            <li key={s.n} className="glass rounded-2xl p-4 transition hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-xs font-semibold text-ink">{s.n}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${WHO_TONE[s.who as keyof typeof WHO_TONE]}`}>{s.who}</span>
              </div>
              <p className="mt-3 text-sm font-semibold">{s.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <Card title="The funnel" subtitle="From raw news to emails in Gmail. Every count is live">
        <ol className="stagger grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Unique articles", funnel.articles, "/discoveries?window=all"],
            ["Funding stories (AI)", funnel.funding, "/discoveries?window=all"],
            ["Filtered out by rules", funnel.filtered, "/rounds/filtered"],
            ["Passed the rules", funnel.rounds_pass, "/rounds"],
            ["Qualified on thesis", funnel.qualified, "/qualified"],
            ["Drafts written", funnel.drafted, "/drafts"],
          ].map(([label, value, href], i) => (
            <li key={label as string}>
              <Link href={href as string} className={`block rounded-xl bg-gradient-to-b px-4 py-3 ring-1 ring-inset transition hover:-translate-y-0.5 ${FUNNEL_TONES[i]}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-60">Step {i + 1}</p>
                <p className="mt-1 font-display text-3xl tabular-nums"><CountUp value={value as number} /></p>
                <p className="text-xs opacity-75">{label as string}</p>
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
            right={<Link href="/discoveries" className="text-xs font-medium text-violet-300 hover:underline">See all →</Link>}
            flush
          >
            {latest.length === 0 ? (
              <div className="px-5 pb-5"><Empty title="Nothing discovered yet">Run the pipeline to pull the latest funding news.</Empty></div>
            ) : (
              <ul className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
                {latest.map((a) => (
                  <li key={a.id} className="px-5 py-3">
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-sm font-medium leading-snug hover:text-violet-300">
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
            right={<Link href="/thesis" className="text-xs font-medium text-violet-300 hover:underline">Open →</Link>}
          >
            <p className="text-sm leading-relaxed text-muted">{thesis.summary}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {thesis.stages.map((s) => <Badge key={s} tone="accent">{s.replace("_", "-")}</Badge>)}
              {thesis.geographies.map((g) => <Badge key={g}>{g}</Badge>)}
              <Badge tone="info">qualify ≥ {thesis.threshold}</Badge>
            </div>
          </Card>

          <Card title="Source health" subtitle="Articles stored per feed" flush>
            <ul className="divide-y divide-white/[0.06] border-t border-white/[0.06] text-sm">
              {sources.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-2">
                  <span className={`flex items-center gap-2 ${s.enabled ? "" : "text-faint line-through"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.enabled ? "bg-lime-300" : "bg-white/20"}`} />
                    {s.name}
                  </span>
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
