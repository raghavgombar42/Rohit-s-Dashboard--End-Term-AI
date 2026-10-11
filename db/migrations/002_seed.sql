-- 002_seed.sql — initial sources and the starting thesis for the fictional Tandem Forge Accelerator.
-- Rohit changes the thesis afterwards in the Supabase Table Editor (table "thesis", row id = 1).

insert into sources (id, name, kind, url) values
  ('inc42',        'Inc42',                     'rss', 'https://inc42.com/feed/'),
  ('yourstory',    'YourStory',                 'rss', 'https://yourstory.com/feed'),
  ('et_funding',   'Economic Times Tech – Funding', 'rss', 'https://economictimes.indiatimes.com/tech/funding/rssfeeds/78570540.cms'),
  ('techcrunch',   'TechCrunch Venture',        'rss', 'https://techcrunch.com/category/venture/feed/'),
  ('gn_seed_india','Google News: seed rounds India', 'google_news',
     'https://news.google.com/rss/search?q=(%22pre-seed%22+OR+%22seed+round%22+OR+%22seed+funding%22)+startup+India+when:2d&hl=en-IN&gl=IN&ceid=IN:en'),
  ('gn_fintech',   'Google News: fintech/insurtech funding India', 'google_news',
     'https://news.google.com/rss/search?q=(fintech+OR+insurtech)+raises+funding+India+when:2d&hl=en-IN&gl=IN&ceid=IN:en'),
  ('gn_d2c',       'Google News: D2C / quick commerce funding India', 'google_news',
     'https://news.google.com/rss/search?q=(D2C+OR+%22quick+commerce%22+OR+eyewear+OR+apparel)+brand+raises+funding+India+when:2d&hl=en-IN&gl=IN&ceid=IN:en'),
  ('gn_entrackr',  'Google News: Entrackr funding', 'google_news',
     'https://news.google.com/rss/search?q=site:entrackr.com+raises+when:2d&hl=en-IN&gl=IN&ceid=IN:en')
on conflict (id) do nothing;

insert into thesis (
  id, accelerator_name, summary, sectors, excluded_sectors, stages, geographies, business_models,
  criteria, threshold, fresh_window_hours, late_catch_days, program_pitch, sender_name, sender_title
) values (
  1,
  'Tandem Forge Accelerator (fictional)',
  'We back Indian founders at pre-seed and seed who are building for the Indian consumer: '
  'fintech and insurtech that widen access to money and protection, and D2C brands and commerce '
  'models (eyewear, apparel, beauty, quick commerce) with a technology or distribution edge.',
  array['fintech', 'insurtech', 'D2C tech', 'D2C consumer brands (eyewear, apparel, beauty, personal care)', 'quick commerce'],
  array['B2B SaaS', 'AI infrastructure / AI-first tooling', 'climate tech', 'crypto / web3'],
  array['pre_seed', 'seed', 'angel'],
  array['India'],
  array['B2C', 'D2C', 'B2B2C'],
  '{
     "sector_fit":            {"weight": 35, "description": "How squarely the startup sits in one of our sectors (fintech, insurtech, D2C tech, D2C consumer brands, quick commerce)."},
     "consumer_model":        {"weight": 20, "description": "Sells to or serves Indian consumers directly (B2C/D2C) or via partners (B2B2C)."},
     "india_focus":           {"weight": 15, "description": "Primary market and operations are in India."},
     "traction_signals":      {"weight": 15, "description": "Concrete evidence of customers, revenue, growth or credible investors in the sources."},
     "program_need":          {"weight": 15, "description": "Signals that a 12-week program on distribution, unit economics, regulation or fundraising would help them now."}
   }'::jsonb,
  65,
  24,
  30,
  'Tandem Forge runs a 12-week program for freshly funded consumer and fintech founders: '
  'hands-on GTM and performance-marketing sprints, unit-economics reviews, RBI/IRDAI regulatory office hours, '
  'and warm introductions to Series A investors at Demo Day. No fee, small equity, cohort of 12.',
  'Rohit Gupta',
  'Program Recruitment Lead, Tandem Forge Accelerator'
) on conflict (id) do nothing;
