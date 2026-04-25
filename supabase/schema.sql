create table if not exists sources (
  id bigserial primary key,
  key text not null unique,
  merchant text not null,
  source_type text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists deal_runs (
  id bigserial primary key,
  trigger_type text not null default 'cron',
  status text not null default 'running',
  notes text,
  amazon_count integer not null default 0,
  woot_count integer not null default 0,
  walmart_count integer not null default 0,
  total_upserted integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists deals_raw (
  id bigserial primary key,
  run_id bigint references deal_runs(id) on delete set null,
  source_key text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

create table if not exists deals (
  id bigserial primary key,
  source_key text not null,
  merchant text not null,
  source_type text not null,
  external_id text,
  title text not null,
  category text not null,
  original_price numeric(10,2),
  sale_price numeric(10,2) not null,
  discount_pct integer,
  product_url text not null,
  image_url text,
  currency text not null default 'USD',
  in_stock boolean not null default true,
  is_student_relevant boolean not null default false,
  is_featured boolean not null default false,
  score numeric(10,2),
  status text not null default 'active',
  fetched_at timestamptz not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deals_status_idx     on deals(status);
create index if not exists deals_category_idx   on deals(category);
create index if not exists deals_score_idx      on deals(score desc);
create index if not exists deals_source_key_idx on deals(source_key);
create index if not exists deals_fetched_at_idx on deals(fetched_at desc);

create unique index if not exists deals_unique_source_product_idx
  on deals(source_key, product_url);

insert into sources (key, merchant, source_type)
values
  ('amazon',  'AMAZON',  'feed'),
  ('walmart', 'WALMART', 'feed'),
  ('target',  'TARGET',  'feed'),
  ('bestbuy', 'BEST BUY','feed'),
  ('woot',    'WOOT',    'feed'),
  ('ebay',    'EBAY',    'feed'),
  ('wayfair', 'WAYFAIR', 'feed'),
  ('rei',     'REI',     'feed'),
  ('macys',   'MACY''S', 'feed'),
  ('adidas',  'ADIDAS',  'feed')
on conflict (key) do nothing;
