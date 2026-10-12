import Link from "next/link";
import { type RoundRow } from "@/lib/queries";
import { roundsData } from "@/lib/cached";
import { BASIS_LABEL, LANE_LABEL, STAGE_LABEL } from "@/lib/labels";
import { Badge, Card, Empty, PageHeader, timeAgo } from "@/components/ui";
import { RoundTabs } from "@/components/round-tabs";

const STATUS: Record<string, { label: string; tone: "info" | "good" | "warn" | "bad" | "neutral" | "accent" }> = {
  new: { label: "Awaiting research & scoring", tone: "info" },
  enriched: { label: "Researched · awaiting scoring", tone: "info" },
  qualified: { label: "Qualified", tone: "good" },
  not_qualified: { label: "Not a thesis fit", tone: "neutral" },
  drafted: { label: "Draft created", tone: "good" },
  already_contacted: { label: "Already contacted — skipped", tone: "warn" },
  needs_review: { label: "Identity needs review", tone: "warn" },
  error: { label: "Error", tone: "bad" },
};

function fmtDay(d: string) {
  return new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function Quote({ label, text }: { label: string; text: unknown }) {
  if (typeof text !== "string" || !text) return null;
  return (
    <div className="text-xs">
      <span className="text-faint">{label} · </span>
      <span className="italic text-muted">“{text}”</span>
    </div>
  );
}

function RoundCard({ r }: { r: RoundRow }) {
  const st = STATUS[r.status] ?? { label: r.status, tone: "neutral" as const };
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 pt-5">
        <div>
          <h3 className="font-display text-2xl leading-tight">{r.name}</h3>
          <p className="mt-0.5 text-sm text-muted">
            {[r.hq_city, r.country].filter(Boolean).join(", ") || "Location not stated"}
            {r.domain && <> · <a className="hover:text-accent" href={`https://${r.domain}`} target="_blank" rel="noreferrer">{r.domain}</a></>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={r.recency_lane === "fresh" ? "good" : "warn"} dot>{LANE_LABEL[r.recency_lane]}</Badge>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
      </div>

      {r.description && <p className="mt-3 text-sm leading-relaxed">{r.description}</p>}

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted">Round</dt>
          <dd className="font-medium">{STAGE_LABEL[r.stage] ?? r.stage}</dd>
          {r.stage_basis && r.stage_basis !== "stated" && <dd className="text-[11px] text-warn">{BASIS_LABEL[r.stage_basis]}</dd>}
        </div>
        <div><dt className="text-xs text-muted">Amount</dt><dd className="font-medium">{r.amount_text ?? <span className="text-faint">not disclosed</span>}</dd></div>
        <div>
          <dt className="text-xs text-muted">Announced</dt>
          <dd className="font-medium">{fmtDay(r.announced_on)}</dd>
          <dd className="text-[11px] text-faint">{BASIS_LABEL[r.date_source]}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Investors</dt>
          <dd className="font-medium">{r.investors.length ? r.investors.join(", ") : <span className="text-faint">not named</span>}</dd>
        </div>
      </dl>

      {r.founders.length > 0 && (
        <p className="mt-3 text-sm"><span className="text-xs text-muted">Founders · </span>{r.founders.map((f) => f.name + (f.role ? ` (${f.role})` : "")).join(", ")}</p>
      )}

      <details className="mt-4 rounded-xl bg-sunken/60 px-4 py-3">
        <summary className="cursor-pointer text-xs font-medium text-muted">
          Evidence & {r.sources.length} source{r.sources.length === 1 ? "" : "s"}
        </summary>
        <div className="mt-3 space-y-1.5">
          <Quote label="startup" text={r.evidence.startup} />
          <Quote label="stage" text={r.evidence.stage} />
          <Quote label="amount" text={r.evidence.amount} />
          <Quote label="date" text={r.evidence.date} />
          <Quote label="founders" text={r.evidence.founders} />
          {typeof r.evidence.country_basis === "string" && (
            <p className="text-xs text-faint">Country {BASIS_LABEL[r.evidence.country_basis] ?? r.evidence.country_basis}</p>
          )}
          {r.evidence.notes?.map((n) => <p key={n} className="text-xs text-warn">⚠ {n}</p>)}
        </div>
        <ul className="mt-3 space-y-1 border-t border-line pt-3">
          {r.sources.map((s) => (
            <li key={s.url} className="text-xs">
              <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-accent">{s.title}</a>
              <span className="text-faint"> · {s.publisher} · {timeAgo(s.published_at)}</span>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

export default async function RoundsPage() {
  const rounds = await roundsData();
  const fresh = rounds.filter((r) => r.recency_lane === "fresh");
  const late = rounds.filter((r) => r.recency_lane === "late_catch");

  return (
    <div>
      <PageHeader
        eyebrow="Steps 2–4 · Extraction, verification, rules"
        title="Funding rounds"
        description="Rounds that passed every hard rule (pre-seed/seed/angel, Indian, newly announced, inside the outreach window) and are qualified or still in the queue. Each fact is backed by a verbatim quote that code checked against the source. Rounds that failed the thesis fit move to the audit tab."
      />
      <RoundTabs active="passed" />
      {rounds.length === 0 ? (
        <Empty title="No rounds have passed the rules yet">The pipeline found no qualifying pre-seed or seed rounds so far. Nothing is filled in with sample data.</Empty>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="mb-3 text-sm font-semibold">Fresh — announced in the last 24 hours <span className="text-muted">({fresh.length})</span></h2>
            {fresh.length === 0 ? (
              <Empty title="No fresh rounds in the last 24 hours">That is an honest result for today&apos;s news. Late catches below are still inside the 30-day outreach window.</Empty>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">{fresh.map((r) => <RoundCard key={r.id} r={r} />)}</div>
            )}
          </section>
          <section>
            <h2 className="mb-1 text-sm font-semibold">Late catches — announced earlier, first seen now <span className="text-muted">({late.length})</span></h2>
            <p className="mb-3 text-xs text-muted">Still inside the founder&apos;s 30–60-day decision window, so worth reaching out.</p>
            <div className="grid gap-4 lg:grid-cols-2">{late.map((r) => <RoundCard key={r.id} r={r} />)}</div>
          </section>
          <p className="text-xs text-faint">
            Next stage: research and thesis scoring. <Link href="/thesis" className="underline">See the thesis</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
