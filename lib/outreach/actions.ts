import { db } from "../db";
import { deleteDraft, sendDraft } from "../gmail";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * Approve & send. Idempotent by construction: the conditional UPDATE moves drafted_gmail → sending
 * for exactly one caller; a double click or a second tab gets 0 rows and sends nothing.
 */
export async function approveAndSend(id: number): Promise<ActionResult> {
  const sql = db();
  const [claimed] = await sql<{ gmail_draft_id: string }[]>`
    update outreach set status = 'sending', approved_at = now()
    where id = ${id} and status = 'drafted_gmail' and gmail_draft_id is not null
    returning gmail_draft_id`;
  if (!claimed) {
    const [o] = await sql<{ status: string }[]>`select status from outreach where id = ${id}`;
    return { ok: false, message: o ? `Not sent: this email is already "${o.status}".` : "Draft not found." };
  }
  try {
    const msg = await sendDraft(claimed.gmail_draft_id);
    await sql`update outreach set status = 'sent', sent_at = now(), gmail_message_id = ${msg.id}, last_error = null where id = ${id}`;
    return { ok: true, message: "Sent (to the safe-mode test inbox)." };
  } catch (e) {
    // Back to drafted so it can be retried; the draft still exists in Gmail.
    await sql`update outreach set status = 'drafted_gmail', last_error = ${(e as Error).message.slice(0, 300)} where id = ${id} and status = 'sending'`;
    return { ok: false, message: `Gmail send failed: ${(e as Error).message}` };
  }
}

/** Reject: delete the Gmail draft, keep the row as history (the startup is never auto-drafted again). */
export async function reject(id: number, reason: string): Promise<ActionResult> {
  const sql = db();
  const [o] = await sql<{ status: string; gmail_draft_id: string | null }[]>`select status, gmail_draft_id from outreach where id = ${id}`;
  if (!o) return { ok: false, message: "Draft not found." };
  if (!["drafted_db", "drafted_gmail", "failed"].includes(o.status)) return { ok: false, message: `Cannot reject: already "${o.status}".` };
  if (o.gmail_draft_id) await deleteDraft(o.gmail_draft_id);
  await sql`update outreach set status = 'rejected', reject_reason = ${reason.slice(0, 500) || "No reason given"} where id = ${id} and status = ${o.status}`;
  return { ok: true, message: "Rejected. The Gmail draft was deleted." };
}
