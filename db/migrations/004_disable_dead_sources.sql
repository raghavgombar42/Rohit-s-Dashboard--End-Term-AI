-- 004 — observed on first live run (2026-10-12): Business Standard returns HTTP 403 to servers;
-- ET Startups feed only contains items older than 31 days. Disabled, not deleted, for the audit trail.
update sources set enabled = false where id in ('bs_startups', 'et_startups');
