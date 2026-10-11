import { listThesisVersions, loadActiveThesis } from "@/lib/thesis";
import { Badge, Card, PageHeader, fmtDateTime, type Tone } from "@/components/ui";

function supabaseTableEditorUrl(): string | null {
  const ref = process.env.SUPABASE_URL?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  return ref ? `https://supabase.com/dashboard/project/${ref}/editor` : null;
}

function Chips({ items, tone = "neutral" }: { items: string[]; tone?: Tone }) {
  if (items.length === 0) return <span className="text-xs text-muted">None</span>;
  return <div className="flex flex-wrap gap-1.5">{items.map((i) => <Badge key={i} tone={tone}>{i}</Badge>)}</div>;
}

export default async function ThesisPage() {
  const [t, versions] = await Promise.all([loadActiveThesis(), listThesisVersions()]);
  const totalWeight = Object.values(t.criteria).reduce((s, c) => s + c.weight, 0);
  const editor = supabaseTableEditorUrl();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Version ${t.version} · edited ${fmtDateTime(t.updated_at)}`}
        title="What Tandem Forge looks for"
        description="This thesis lives in Supabase (table “thesis”, row 1). Every edit is validated, versioned and snapshotted by the database itself. The next scoring run uses it with no code change or deploy. Past assessments keep the version they were scored with."
        actions={
          editor && (
            <a href={editor} target="_blank" rel="noreferrer" className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-500/25 hover:opacity-90">
              Edit in Supabase ↗
            </a>
          )
        }
      />

      <Card>
        <p className="pt-5 font-display text-2xl leading-snug">“{t.summary}”</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Hard gates" subtitle="Checked by code. Failing any one disqualifies, with no AI judgement involved">
          <dl className="space-y-4 text-sm">
            <div><dt className="mb-1.5 text-xs text-muted">Funding stages</dt><dd><Chips items={t.stages} tone="accent" /></dd></div>
            <div><dt className="mb-1.5 text-xs text-muted">Headquartered in</dt><dd><Chips items={t.geographies} /></dd></div>
            <div><dt className="mb-1.5 text-xs text-muted">Excluded sectors</dt><dd><Chips items={t.excluded_sectors} tone="bad" /></dd></div>
            <div>
              <dt className="mb-1.5 text-xs text-muted">Recency</dt>
              <dd className="flex flex-wrap gap-1.5">
                <Badge tone="good">Fresh: announced within {t.fresh_window_hours}h</Badge>
                <Badge tone="warn">Late catch: up to {t.late_catch_days} days</Badge>
              </dd>
            </div>
          </dl>
        </Card>

        <Card title="Scored criteria" subtitle={`Gemini scores each 0–10 and must cite evidence. Code computes the weighted total; qualify at ≥ ${t.threshold}/100`}>
          <ul className="space-y-4">
            {Object.entries(t.criteria).map(([key, c]) => {
              const pct = Math.round((c.weight / totalWeight) * 100);
              return (
                <li key={key}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{key.replaceAll("_", " ")}</span>
                    <span className="text-xs text-muted tabular-nums">{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-sunken"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${pct}%` }} /></div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">{c.description}</p>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Target sectors & business models">
          <div className="space-y-3"><Chips items={t.sectors} tone="good" /><Chips items={t.business_models} /></div>
        </Card>

        <Card title="Outreach voice" subtitle="What the emails offer, and who signs them">
          <p className="text-sm leading-relaxed">{t.program_pitch}</p>
          <p className="mt-3 text-xs text-muted">— {t.sender_name}, {t.sender_title}</p>
        </Card>
      </div>

      <Card title="Version history" subtitle="Immutable snapshots written by a database trigger on every edit" flush>
        <ul className="divide-y divide-line border-t border-line text-sm">
          {versions.map((v) => (
            <li key={v.version} className="flex items-center justify-between px-5 py-2.5">
              <span className="flex items-center gap-2 font-medium">v{v.version}{v.version === t.version && <Badge tone="good" dot>active</Badge>}</span>
              <span className="text-xs text-muted">{fmtDateTime(v.created_at)} · threshold {String(v.snapshot.threshold)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
