import type { AssessedRow } from "@/lib/queries";
import { LANE_LABEL, STAGE_LABEL } from "@/lib/labels";
import { Badge, Card } from "./ui";

export function ScoreRing({ score, threshold, size = 76 }: { score: number; threshold: number; size?: number }) {
  const pass = score >= threshold;
  const color = pass ? "#7c3aed" : "#94a0b8";
  return (
    <div className="relative grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: `conic-gradient(${color} ${score * 3.6}deg, #eef1f8 0deg)` }}>
      <div className="grid place-items-center rounded-full bg-surface" style={{ width: size - 12, height: size - 12 }}>
        <span className="font-display text-2xl leading-none tabular-nums">{Math.round(score)}</span>
        <span className="text-[9px] uppercase tracking-wider text-faint">/ 100</span>
      </div>
    </div>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  product: "Product", customers: "Customers", traction: "Traction", team: "Team", funding_use: "Use of funds", market: "Market", other: "Other",
};

export function CriteriaBars({ a }: { a: AssessedRow }) {
  const entries = Object.entries(a.criteria_scores).filter(([k]) => k !== "_meta") as [string, AssessedRow["criteria_scores"][string]][];
  return (
    <ul className="space-y-3">
      {entries.map(([key, c]) => (
        <li key={key}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium capitalize">{key.replaceAll("_", " ")} <span className="font-normal text-faint">· weight {c.weight}</span></span>
            <span className="tabular-nums text-muted">{c.score}/10</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-sunken">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${c.score * 10}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">{c.reasoning}</p>
          {c.evidence && (
            <p className={`mt-0.5 text-[11px] italic ${c.evidence_verified ? "text-faint" : "text-bad"}`}>
              {c.evidence_verified ? "Evidence" : "Unverified evidence → scored 0"}: “{c.evidence}”
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function QualifiedCard({ a, threshold }: { a: AssessedRow; threshold: number }) {
  const r = a.research;
  const meta = a.criteria_scores._meta;
  return (
    <Card>
      <div className="flex flex-wrap items-start gap-5 pt-5">
        <ScoreRing score={Number(a.total)} threshold={threshold} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-3xl leading-tight">{a.name}</h3>
            <Badge tone={a.recency_lane === "fresh" ? "good" : "warn"} dot>{LANE_LABEL[a.recency_lane]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {STAGE_LABEL[a.stage]}{a.amount_text ? ` · ${a.amount_text}` : ""} · {[a.hq_city, a.country].filter(Boolean).join(", ")}
            {r?.website && <> · <a href={r.website.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{new URL(r.website.url).hostname.replace(/^www\./, "")}</a></>}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {meta?.primary_sector && <Badge tone="accent">{meta.primary_sector}</Badge>}
            {meta?.business_model && <Badge tone="info">{meta.business_model}</Badge>}
            {a.investors.slice(0, 3).map((i) => <Badge key={i}>{i}</Badge>)}
          </div>
        </div>
      </div>

      {a.summary && <p className="mt-4 rounded-xl bg-accent-soft/60 px-4 py-3 text-sm leading-relaxed text-ink">{a.summary}</p>}

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Research brief</h4>
          {r?.one_liner && <p className="mb-2 text-sm">{r.one_liner}</p>}
          <ul className="space-y-1.5">
            {r?.facts.map((f, i) => (
              <li key={i} className="text-sm leading-snug">
                <span className="mr-1.5 text-[11px] font-medium text-accent">{CATEGORY_LABEL[f.category] ?? f.category}</span>
                {f.claim}{" "}
                <a href={f.source_url} target="_blank" rel="noreferrer" title={`“${f.quote}”`} className="text-[11px] text-faint hover:text-accent">[{f.source_id}]</a>
              </li>
            ))}
          </ul>
          {a.founders.length > 0 && <p className="mt-3 text-xs text-muted">Founders: {a.founders.map((f) => f.name).join(", ")}</p>}
        </div>
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Thesis fit · v{a.thesis_version}</h4>
          <CriteriaBars a={a} />
        </div>
      </div>

      {r && r.sources.length > 0 && (
        <p className="mt-4 border-t border-line pt-3 text-[11px] text-faint">
          Sources:{" "}
          {r.sources.map((s, i) => (
            <span key={s.id}>
              {i > 0 && " · "}
              <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-accent">{s.id} {s.kind === "website" ? "company site" : "article"}</a>
            </span>
          ))}
        </p>
      )}
    </Card>
  );
}
