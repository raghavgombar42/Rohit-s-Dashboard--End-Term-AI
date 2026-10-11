-- 005 — hourly pipeline trigger from inside Supabase (Vercel Hobby cron is limited to once a day).
-- pg_cron fires every hour at :05; pg_net POSTs to the Vercel endpoint with the bearer secret,
-- which is read from Supabase Vault (secret name 'cron_secret', stored by scripts/set-cron-secret.ts,
-- never committed to git).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'funding-pipeline-hourly',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'https://tandem-forge-outreach.vercel.app/api/cron/run?trigger=cron_hourly',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 290000
  );
  $$
);
