-- supabase/migrate_extend_deal_runs.sql
--
-- Audit fix #4: deal_runs was missing per-source counts and per-source error
-- strings — when a feed silently returned 0 deals, we had no way to know
-- whether it was rate-limited, returned an empty result, or threw. Adding
-- those columns now.
--
-- Also drops the ingest_log table — dead schema, no current code writes to
-- it. Last entry was 2026-04-24, only 10 rows total. Code reads/writes
-- deal_runs everywhere; consolidating on one table.

-- ── 1. Extend deal_runs with per-source counts ──────────────────────────────
-- Existing columns: id, trigger_type, status, notes, started_at, finished_at,
--                   amazon_count, woot_count, walmart_count, total_upserted
-- The amazon_count and woot_count columns are stale (those feeds were dropped
-- pre-Apr 28 per session memory) but kept for historical row compatibility.
ALTER TABLE deal_runs
  ADD COLUMN IF NOT EXISTS target_count     int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS slickdeals_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bestbuy_count    int DEFAULT 0;

-- Per-source error strings — null when the feed succeeded, the exception
-- message when it failed both retry attempts. Lets us see *why* a source
-- returned 0 from the SQL log without digging in Vercel runtime logs.
ALTER TABLE deal_runs
  ADD COLUMN IF NOT EXISTS walmart_error    text,
  ADD COLUMN IF NOT EXISTS target_error     text,
  ADD COLUMN IF NOT EXISTS slickdeals_error text,
  ADD COLUMN IF NOT EXISTS bestbuy_error    text;

-- Sources actually attempted this run. Lets us tell apart "feed was disabled
-- via env var" vs "feed ran and got 0 deals" — both look like 0 in count
-- columns alone.
ALTER TABLE deal_runs
  ADD COLUMN IF NOT EXISTS sources_requested text[];

-- ── 2. Drop ingest_log (dead schema) ────────────────────────────────────────
-- Only writers were earlier code paths that have since been removed. Last
-- write was 2026-04-24. Nothing reads from it.
DROP TABLE IF EXISTS ingest_log;
