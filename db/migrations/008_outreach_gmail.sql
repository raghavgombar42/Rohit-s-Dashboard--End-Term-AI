-- 008 — M6 outreach lifecycle.
-- 'closed_in_gmail': the Gmail draft disappeared (Rohit sent or deleted it directly in Gmail).
-- It still counts as contact history, so the startup is never drafted again.
alter table outreach drop constraint outreach_status_check;
alter table outreach add constraint outreach_status_check
  check (status in ('drafted_db', 'drafted_gmail', 'sending', 'sent', 'rejected', 'failed', 'closed_in_gmail'));
alter table outreach add column validation jsonb;     -- automated checks the email passed (audit)
alter table outreach add column round_snapshot jsonb; -- facts the email was written from
