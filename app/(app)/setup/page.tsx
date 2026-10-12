import { gmailStatus } from "@/lib/gmail";
import { db } from "@/lib/db";
import { operatorMode } from "@/components/operator";
import { Badge, Card, PageHeader, fmtDateTime } from "@/components/ui";

export default async function SetupPage({ searchParams }: PageProps<"/setup">) {
  const sp = await searchParams;
  const [gmail, operator, cronRows] = await Promise.all([
    gmailStatus(),
    operatorMode(),
    db()<{ last: Date | null }[]>`select max(started_at) as last from pipeline_runs where trigger = 'cron_hourly'`,
  ]);
  const cron = cronRows[0];
  const has = (k: string) => Boolean(process.env[k]);

  const rows: { name: string; ok: boolean; optional?: boolean; detail: string }[] = [
    { name: "Gemini Flash", ok: has("GEMINI_API_KEY"), detail: `Model ${process.env.GEMINI_MODEL ?? "gemini-3.8-flash"} for every AI step` },
    { name: "Supabase Postgres", ok: has("DATABASE_URL"), detail: "Articles, rounds, thesis, assessments, outreach and logs" },
    { name: "Gmail drafts", ok: Boolean(gmail?.account_email), detail: gmail?.account_email ? `Connected as ${gmail.account_email}` : "Not connected" },
    { name: "Hourly schedule", ok: Boolean(cron?.last), detail: cron?.last ? `Supabase pg_cron, last run ${fmtDateTime(cron.last)}` : "No hourly run yet" },
    { name: "Safe mode", ok: has("EMAIL_OVERRIDE_TO"), detail: "Every email goes to the test inbox, never to founders" },
    {
      name: "Hunter.io contact finder",
      ok: has("HUNTER_API_KEY"),
      optional: true,
      detail: has("HUNTER_API_KEY") ? "Enabled" : "Not configured: only emails published on the startup's own website are used",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuration"
        title="Setup & integrations"
        description="What the engine is connected to. Secrets live in Vercel environment variables; the Gmail token is stored encrypted (AES-256-GCM)."
      />
      {sp.gmail === "connected" && (
        <p className="rounded-xl bg-good-soft px-4 py-3 text-sm text-good">Gmail connected as {String(sp.as)}. Drafts will appear in its Drafts folder on the next run.</p>
      )}
      {sp.gmail === "error" && <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">Gmail connection failed: {String(sp.reason)}</p>}
      {sp.gmail === "denied" && <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">Unlock operator mode first, then connect Gmail.</p>}

      <Card flush>
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div>
                <p className="text-sm font-medium">{r.name}</p>
                <p className="text-xs text-muted">{r.detail}</p>
              </div>
              <Badge tone={r.ok ? "good" : r.optional ? "neutral" : "warn"} dot>{r.ok ? "OK" : r.optional ? "Optional" : "Action needed"}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Gmail — Rohit's draft folder" subtitle="OAuth scope gmail.compose: create drafts and send. The app cannot read the inbox.">
        {gmail?.last_error && <p className="mb-3 text-xs text-bad">Last error: {gmail.last_error}</p>}
        {operator ? (
          <a
            href="/api/google/connect"
            className="inline-flex rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-500/25 hover:opacity-90"
          >
            {gmail?.account_email ? "Reconnect Gmail" : "Connect Gmail"}
          </a>
        ) : (
          <p className="text-sm text-muted">Unlock operator mode (top right) to connect Gmail.</p>
        )}
      </Card>
    </div>
  );
}
