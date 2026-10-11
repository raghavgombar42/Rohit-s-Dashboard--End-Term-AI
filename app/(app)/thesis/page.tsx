import { listThesisVersions, loadActiveThesis } from "@/lib/thesis";
import { Badge, Card, fmtDateTime } from "@/components/ui";

function supabaseTableEditorUrl(): string | null {
  const url = process.env.SUPABASE_URL;
  const ref = url?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  return ref ? `https://supabase.com/dashboard/project/${ref}/editor` : null;
}

function Chips({ items, tone = "neutral" }: { items: string[]; tone?: "neutral" | "bad" }) {
  if (items.length === 0) return <span className="text-xs text-muted">None</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => <Badge key={i} tone={tone}>{i}</Badge>)}
    </div>
  );
}

export default async function ThesisPage() {
  const [t, versions] = await Promise.all([loadActiveThesis(), listThesisVersions()]);
  const totalWeight = Object.values(t.criteria).reduce((s, c) => s + c.weight, 0);
  const editor = supabaseTableEditorUrl();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Accelerator thesis</h1>
          <p className="text-sm text-muted">
            {t.accelerator_name} · version {t.version} · updated {fmtDateTime(t.updated_at)}
          </p>
        </div>
        {editor && (
          <a href={editor} target="_blank" rel="noreferrer" className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90">
            Edit in Supabase ↗
          </a>
        )}
      </div>

      <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
        Edit table <code className="font-mono text-ink">thesis</code> (row id 1) in the Supabase Table Editor. Each change
        is validated, gets a new version number and is snapshotted automatically. The next scoring run uses it with no code
        change or deploy. Past assessments keep the version they were scored with.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="What we look for">
          <p className="text-sm">{t.summary}</p>
        </Card>
        <Card title="Hard gates" subtitle="Applied by code. Failing any gate disqualifies, with no AI judgement">
          <dl className="space-y-3 text-sm">
            <div><dt className="mb-1 text-xs text-muted">Funding stages</dt><dd><Chips items={t.stages} /></dd></div>
            <div><dt className="mb-1 text-xs text-muted">Geographies</dt><dd><Chips items={t.geographies} /></dd></div>
            <div><dt className="mb-1 text-xs text-muted">Excluded sectors</dt><dd><Chips items={t.excluded_sectors} tone="bad" /></dd></div>
            <div>
              <dt className="mb-1 text-xs text-muted">Recency</dt>
              <dd>Fresh: announced within {t.fresh_window_hours}h · Late catch: up to {t.late_catch_days} days</dd>
            </div>
          </dl>
        </Card>
        <Card title="Scored criteria" subtitle={`Gemini scores each 0–10 with evidence; code computes the weighted total. Qualify at ≥ ${t.threshold}/100`}>
          <ul className="space-y-3 text-sm">
            {Object.entries(t.criteria).map(([key, c]) => (
              <li key={key}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{key}</span>
                  <span className="text-xs text-muted tabular-nums">{Math.round((c.weight / totalWeight) * 100)}% weight</span>
                </div>
                <p className="text-xs text-muted">{c.description}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Target sectors & models">
          <div className="space-y-3">
            <Chips items={t.sectors} />
            <Chips items={t.business_models} />
          </div>
        </Card>
        <Card title="Outreach voice" subtitle="Used when writing emails">
          <p className="text-sm">{t.program_pitch}</p>
          <p className="mt-3 text-xs text-muted">Signed: {t.sender_name}, {t.sender_title}</p>
        </Card>
        <Card title="Version history" subtitle="Immutable snapshots written by a database trigger">
          <ul className="divide-y divide-line text-sm">
            {versions.map((v) => (
              <li key={v.version} className="flex justify-between py-1.5">
                <span>v{v.version}{v.version === t.version && <span className="ml-2"><Badge tone="good">active</Badge></span>}</span>
                <span className="text-xs text-muted">{fmtDateTime(v.created_at)} · threshold {String(v.snapshot.threshold)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
