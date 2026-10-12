import { db } from "../db";
import { EMAIL_OVERRIDE_TO } from "../env";
import { generateJSON } from "../gemini";
import { createDraft, getDraft, GmailNotConnected } from "../gmail";
import { STAGE_LABEL } from "../labels";
import { findContact } from "../outreach/contacts";
import { EMAIL_PROMPT_VERSION, EMAIL_SYSTEM, EmailSchema, emailPrompt, validateEmail, type EmailInput } from "../outreach/email";
import { loadActiveThesis } from "../thesis";
import type { RunContext } from "./context";

const PER_RUN_LIMIT = 8;

type Qualified = {
  round_id: number; startup_id: number; assessment_id: number; name: string; website: string | null; domain: string | null;
  founders: { name: string; role: string | null }[]; stage: string; amount_text: string | null; investors: string[];
  research: { facts: { claim: string }[]; one_liner: string } | null; source_docs: { text: string }[] | null; is_replay: boolean;
};

/** S11–S13: contact discovery, Gemini email, code validation, then an outreach row (DB-enforced: one per startup). */
export async function draftStage(ctx: RunContext): Promise<void> {
  const sql = db();
  const thesis = await loadActiveThesis();
  const queue = await sql<Qualified[]>`
    select r.id::int as round_id, s.id::int as startup_id,
           (select a.id::int from assessments a where a.round_id = r.id order by a.id desc limit 1) as assessment_id,
           s.name, s.website, s.domain, s.founders, r.stage, r.amount_text, r.investors, r.research, r.source_docs, r.is_replay
    from funding_rounds r join startups s on s.id = r.startup_id
    where r.status = 'qualified' and r.attempts < 3
      -- contact history: any outreach ever (sent, drafted, rejected, closed) blocks a new draft
      and not exists (select 1 from outreach o where o.startup_id = s.id)
    order by r.recency_lane = 'fresh' desc, r.announced_on desc
    limit ${PER_RUN_LIMIT}`;

  for (const q of queue) {
    if (ctx.timeLeft() < 35_000) break;
    try {
      await draftOne(ctx, q, thesis);
    } catch (e) {
      ctx.bump("draft_errors");
      await sql`update funding_rounds set attempts = attempts + 1, last_error = ${(e as Error).message.slice(0, 500)} where id = ${q.round_id}`;
      await ctx.log("warn", "draft", `${q.name}: ${(e as Error).message}`, { entityType: "round", entityId: q.round_id });
    }
  }
}

async function draftOne(ctx: RunContext, q: Qualified, thesis: Awaited<ReturnType<typeof loadActiveThesis>>) {
  const sql = db();
  const contact = await findContact(q.website, q.domain, q.founders, (q.source_docs ?? []).map((d) => d.text));

  const input: EmailInput = {
    startup: q.name,
    // Address the founder whose email we found, else all named founders.
    founders: contact?.name ? q.founders.filter((f) => f.name === contact.name) : q.founders,
    round: { stage: STAGE_LABEL[q.stage] ?? q.stage, amount: q.amount_text, investors: q.investors },
    facts: (q.research?.facts ?? []).slice(0, 10).map((f, i) => ({ id: `F${i + 1}`, text: f.claim })),
    pitch: thesis.program_pitch,
    sender: { name: thesis.sender_name, title: thesis.sender_title },
  };
  if (q.research?.one_liner) input.facts.unshift({ id: "F0", text: q.research.one_liner });

  let email = null;
  let problems: string[] = [];
  for (let attempt = 0; attempt < 2 && !email; attempt++) {
    const { data } = await generateJSON({
      purpose: "email", runId: ctx.runId, system: EMAIL_SYSTEM, schema: EmailSchema, thinking: "LOW",
      prompt: emailPrompt(input, attempt > 0 ? problems : undefined),
    });
    problems = validateEmail(data, input);
    if (problems.length === 0) email = data;
    else ctx.bump("email_regenerated");
  }
  if (!email) throw new Error(`Email failed automated checks twice: ${problems.join(" | ")}`);

  const tag = contact ? contact.email : "no verified contact";
  const subject = `[TEST → ${tag}] ${email.subject}`;
  const inserted = await sql.begin(async (tx) => {
    const rows = await tx`
      insert into outreach (startup_id, round_id, assessment_id, intended_to, intended_to_name, intended_to_source, intended_to_status,
                            sent_to, subject, body, hooks, validation, round_snapshot, status, is_replay)
      values (${q.startup_id}, ${q.round_id}, ${q.assessment_id}, ${contact?.email ?? null}, ${contact?.name ?? null}, ${contact?.source ?? null},
              ${contact?.status ?? "not_found"}, ${EMAIL_OVERRIDE_TO()}, ${subject}, ${email.body}, ${tx.json(email.used_fact_ids)},
              ${tx.json({ prompt: EMAIL_PROMPT_VERSION, checks_passed: true } as never)}, ${tx.json(input as never)}, 'drafted_db', ${q.is_replay})
      on conflict (startup_id) where status <> 'rejected' do nothing
      returning id`;
    if (rows.length) await tx`update funding_rounds set status = 'drafted', attempts = 0 where id = ${q.round_id}`;
    return rows.length > 0;
  });
  ctx.bump(inserted ? "drafts_written" : "drafts_skipped_duplicate");
  await ctx.log("info", "draft", `${q.name}: email written (${contact ? `contact ${contact.email} from ${contact.source}` : "no verified contact found"})`, {
    entityType: "round", entityId: q.round_id,
  });
}

/**
 * S14: push app drafts into Rohit's Gmail Drafts folder, and notice drafts Rohit handled directly in Gmail.
 * Idempotent: only rows without a gmail_draft_id are pushed.
 */
export async function gmailSyncStage(ctx: RunContext): Promise<void> {
  const sql = db();
  const pending = await sql<{ id: number; sent_to: string; subject: string; body: string }[]>`
    select id::int, sent_to, subject, body from outreach where status = 'drafted_db' and gmail_draft_id is null order by id limit 20`;
  for (const o of pending) {
    try {
      const d = await createDraft({ to: o.sent_to, subject: o.subject, body: o.body, outreachId: o.id });
      await sql`update outreach set gmail_draft_id = ${d.id}, gmail_message_id = ${d.message.id}, status = 'drafted_gmail', last_error = null
                where id = ${o.id} and status = 'drafted_db'`;
      ctx.bump("gmail_drafts_created");
    } catch (e) {
      if (e instanceof GmailNotConnected) {
        await ctx.log("warn", "gmail", `${pending.length} draft(s) waiting: Gmail is not connected yet (Setup page)`);
        return;
      }
      await sql`update outreach set last_error = ${(e as Error).message.slice(0, 300)} where id = ${o.id}`;
      await ctx.log("warn", "gmail", `Draft ${o.id}: ${(e as Error).message}`, { entityType: "outreach", entityId: o.id });
    }
  }

  // Drafts that vanished from Gmail were sent or deleted by Rohit there. Record it as contact history.
  const live = await sql<{ id: number; gmail_draft_id: string }[]>`
    select id::int, gmail_draft_id from outreach where status = 'drafted_gmail' order by id limit 30`;
  for (const o of live) {
    try {
      if ((await getDraft(o.gmail_draft_id)) === null) {
        await sql`update outreach set status = 'closed_in_gmail' where id = ${o.id} and status = 'drafted_gmail'`;
        ctx.bump("gmail_drafts_closed_by_rohit");
      }
    } catch (e) {
      if (e instanceof GmailNotConnected) return;
    }
  }
}
