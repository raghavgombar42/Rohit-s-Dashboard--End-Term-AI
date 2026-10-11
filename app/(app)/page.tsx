import Link from "next/link";
import { db } from "@/lib/db";
import { loadActiveThesis } from "@/lib/thesis";
import { Badge, Card, Empty, fmtDateTime } from "@/components/ui";

async function getOverview() {
  const sql = db();
  const [runs, sources, gmail, counts] = await Promise.all([
    sql`select id, trigger, status, started_at, finished_at, counts from pipeline_runs order by started_at desc limit 5`,
    sql`select id, name, kind, enabled from sources order by kind, name`,
    sql`select account_email, connected_at, last_ok_at, last_error from integrations where provider = 'gmail'`,
    sql`select
          (select count(*) from articles where not is_replay)::int as articles,
          (select count(*) from funding_rounds where not is_replay)::int as rounds,
          (select count(*) from outreach where status in ('drafted_gmail','drafted_db') and not is_replay)::int as drafts,
          (select count(*) from outreach where status = 'sent')::int as sent`,
  ]);
  return { runs, sources, gmail: gmail[0], counts: counts[0] };
}

export default async function OverviewPage() {
  const [{ runs, sources, gmail, counts }, thesis] = await Promise.all([getOverview(), loadActiveThesis()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Good morning, Rohit</h1>
        <p className="text-sm text-muted">Every number on this page is read live from Supabase. Nothing here is sample data.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Articles ingested", counts.articles],
          ["Funding rounds found", counts.rounds],
          ["Drafts awaiting review", counts.drafts],
          ["Emails sent (test inbox)", counts.sent],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-surface px-5 py-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Recent pipeline runs" subtitle="Hourly schedule plus manual runs">
          {runs.length === 0 ? (
            <Empty title="No runs yet">The pipeline has not run. Ingestion ships in the next milestone.</Empty>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {runs.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <span>#{r.id} · {r.trigger}</span>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {fmtDateTime(r.started_at)}
                    <Badge tone={r.status === "succeeded" ? "good" : r.status === "running" ? "neutral" : "bad"}>{r.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Active thesis"
          subtitle={`Version ${thesis.version} · updated ${fmtDateTime(thesis.updated_at)}`}
          right={<Link href="/thesis" className="text-xs font-medium text-accent hover:underline">View</Link>}
        >
          <p className="text-sm">{thesis.summary}</p>
          <p className="mt-3 text-xs text-muted">
            Stages: {thesis.stages.join(", ")} · Geography: {thesis.geographies.join(", ")} · Qualify at ≥ {thesis.threshold}/100
          </p>
        </Card>

        <Card title="Live sources" subtitle="Feeds the engine monitors">
          <ul className="space-y-1.5 text-sm">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between">
                <span>{s.name}</span>
                <Badge tone={s.enabled ? "good" : "neutral"}>{s.kind === "rss" ? "RSS" : "Google News"}{s.enabled ? "" : " · off"}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Gmail drafts connection" subtitle="Where drafts are created">
          {gmail?.account_email ? (
            <p className="text-sm">
              Connected as <strong>{gmail.account_email}</strong> since {fmtDateTime(gmail.connected_at)}
            </p>
          ) : (
            <Empty title="Gmail not connected yet">The Connect Gmail flow ships in the Gmail milestone.</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}
