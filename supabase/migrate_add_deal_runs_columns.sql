-- supabase/migrate_add_deal_runs_columns.sql
-- Aligns the live `deal_runs` table with what app/api/cron/refresh-deals
-- and lib/ingest/runIngest.js actually write.
--
-- Run this in Supabase → SQL Editor. Idempotent — safe to run multiple times.
--
-- What this fixes:
-- - The cron writes amazon_count, woot_count, walmart_count, total_upserted
--   but the original schema didn't define them, so those values were either
--   silently dropped (if columns existed via earlier ad-hoc ALTERs) or the
--   inserts were failing on every run.
-- - trigger_type was NOT NULL with no default, so any insert that forgot
--   to include it would 500. Now defaults to 'cron'.

alter table deal_runs add column if not exists amazon_count   integer not null default 0;
alter table deal_runs add column if not exists woot_count     integer not null default 0;
alter table deal_runs add column if not exists walmart_count  integer not null default 0;
alter table deal_runs add column if not exists total_upserted integer not null default 0;

alter table deal_runs alter column trigger_type set default 'cron';

-- Verify (optional — paste this in SQL Editor after the ALTERs to confirm)
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_name = 'deal_runs'
-- order by ordinal_position;
