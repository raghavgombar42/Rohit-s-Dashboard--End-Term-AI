-- 003_more_sources.sql — direct publisher feeds found during M3 source checks (2026-10-12).
-- Direct feeds matter because Google News links cannot be resolved to article text server-side.
insert into sources (id, name, kind, url) values
  ('entrackr',     'Entrackr',                      'rss', 'https://entrackr.com/rss'),
  ('inc42_buzz',   'Inc42 Buzz (full text)',        'rss', 'https://inc42.com/buzz/feed/'),
  ('bs_startups',  'Business Standard – Startups',  'rss', 'https://www.business-standard.com/rss/companies-startups-10101.rss'),
  ('et_startups',  'Economic Times – Startups',     'rss', 'https://economictimes.indiatimes.com/small-biz/startups/rssfeeds/11993050.cms')
on conflict (id) do nothing;

-- Entrackr is now fetched directly; the Google News proxy query for it is redundant.
update sources set enabled = false where id = 'gn_entrackr';
