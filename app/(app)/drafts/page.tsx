import { resilient } from "@/lib/db";
import Link from "next/link";
import { listOutreach, type OutreachRow } from "@/lib/queries";
import { STAGE_LABEL } from "@/lib/labels";
import { operatorMode } from "@/components/operator";
import { Badge, Card, Empty, PageHeader, fmtDateTime, type Tone } from "@/components/ui";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  drafted_gmail: { label: "In Rohit's Gmail drafts", tone: "accent" },
  drafted_db: { label: "Written · waiting for Gmail", tone: "info" },
  sending: { label: "Sending…", tone: "info" },
  sent: { label: "Sent", tone: "good" },
  rejected: { label: "Rejected", tone: "neutral" },
  failed: { label: "Failed", tone: "bad" },
  closed_in_gmail: { label: "Handled in Gmail", tone: "good" },
};

const CONTACT: Record<string, string> = {
  published_on_site: "published on the startup's own website",
  published_in_article: "published in a news article",
  hunter_verified: "found by Hunter.io and verified deliverable",
  hunter_unverified: "found by Hunter.io, deliverability not confirmed",
  not_found: "no verified email found — find one before any real send",
};

function DraftCard({ o, operator }: { o: OutreachRow; operator: boolean }) {
  const st = STATUS[o.status] ?? { label: o.status, tone: "neutral" as Tone };
  const open = ["drafted_gmail", "drafted_db", "failed"].includes(o.status);
  return (
    <div id={`o${o.id}`} className="scroll-mt-28">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 pt-5">
          <div>
            <h3 className="font-display text-2xl leading-tight">{o.startup}</h3>
            <p className="text-xs text-muted">
              {STAGE_LABEL[o.stage]}{o.amount_text ? ` · ${o.amount_text}` : ""} · fit {o.total ? Math.round(Number(o.total)) : "—"}/100 · written {fmtDateTime(o.created_at)}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {o.is_replay && <Badge tone="warn">Historical replay</Badge>}
            <Badge tone={o.recency_lane === "fresh" ? "good" : "warn"} dot>{o.recency_lane === "fresh" ? "Fresh" : "Late catch"}</Badge>
            <Badge tone={st.tone} dot>{st.label}</Badge>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-line bg-background">
          <div className="space-y-1 border-b border-line px-4 py-2.5 text-xs">
            <p><span className="text-faint">To · </span><span className="font-medium">{o.sent_to}</span> <span className="text-faint">(safe-mode test inbox)</span></p>
            <p>
              <span className="text-faint">Founder contact · </span>
              {o.intended_to ? <span className="font-medium">{o.intended_to}</span> : <span className="text-warn">none</span>}
              <span className="text-faint"> — {CONTACT[o.intended_to_status ?? "not_found"] ?? o.intended_to_status}</span>
            </p>
            <p><span className="text-faint">Subject · </span><span className="font-medium">{o.subject}</span></p>
          </div>
          <pre className="whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-relaxed">{o.body}</pre>
        </div>

        {o.last_error && <p className="mt-2 text-xs text-bad">{o.last_error}</p>}
        {o.reject_reason && <p className="mt-2 text-xs text-muted">Rejected: {o.reject_reason}</p>}
        {o.sent_at && <p className="mt-2 text-xs text-good">Sent {fmtDateTime(o.sent_at)} to {o.sent_to}</p>}

        {open && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {o.gmail_message_id && (
              <a
                href={`https://mail.google.com/mail/u/0/#drafts?compose=${o.gmail_message_id}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium hover:bg-sunken"
              >
                Open in Gmail ↗
              </a>
            )}
            {operator ? (
              <>
                {o.status === "drafted_gmail" && (
                  <form action={`/api/actions/outreach/${o.id}`} method="post">
                    <input type="hidden" name="intent" value="send" />
                    <button className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 hover:opacity-90">
                      ✓ Approve & send
                    </button>
                  </form>
                )}
                <form action={`/api/actions/outreach/${o.id}`} method="post" className="flex items-center gap-2">
                  <input type="hidden" name="intent" value="reject" />
                  <input name="reason" placeholder="Reason (optional)" className="w-44 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent" />
                  <button className="rounded-xl border border-bad/30 px-3.5 py-2 text-sm font-medium text-bad hover:bg-bad-soft">Reject</button>
                </form>
              </>
            ) : (
              <span className="text-xs text-faint">Unlock operator mode (top right) to approve or reject.</span>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export default async function DraftsPage({ searchParams }: PageProps<"/drafts">) {
  const sp = await searchParams;
  const [rows, operator] = await resilient(() => Promise.all([listOutreach(), operatorMode()]));
  const isOpen = (o: OutreachRow) => ["drafted_gmail", "drafted_db", "sending", "failed"].includes(o.status);
  const open = rows.filter(isOpen);
  const done = rows.filter((o) => !isOpen(o));

  return (
    <div>
      <PageHeader
        eyebrow="Step 7 · Rohit reviews"
        title="Drafts for review"
        description="One personalised email per qualified startup, written by Gemini from verified facts only and checked by code, sitting in Rohit's Gmail Drafts folder. Safe mode: every email is addressed to the test inbox; the founder's address is shown for reference only."
      />
      {typeof sp.ok === "string" && <p className="mb-4 rounded-xl bg-good-soft px-4 py-3 text-sm text-good">{sp.ok}</p>}
      {typeof sp.err === "string" && <p className="mb-4 rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">{sp.err}</p>}

      <h2 className="mb-3 text-sm font-semibold">Waiting for review <span className="text-muted">({open.length})</span></h2>
      {open.length === 0 ? (
        <Empty title="Nothing waiting">
          New drafts appear here after the hourly run finds and qualifies a startup. See <Link href="/qualified" className="underline">Qualified</Link>.
        </Empty>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">{open.map((o) => <DraftCard key={o.id} o={o} operator={operator} />)}</div>
      )}

      {done.length > 0 && (
        <>
          <h2 className="mb-1 mt-10 text-sm font-semibold">Contact history <span className="text-muted">({done.length})</span></h2>
          <p className="mb-3 text-xs text-muted">Sent, rejected or handled in Gmail. These startups will never be drafted again.</p>
          <div className="grid gap-5 lg:grid-cols-2">{done.map((o) => <DraftCard key={o.id} o={o} operator={operator} />)}</div>
        </>
      )}
    </div>
  );
}
