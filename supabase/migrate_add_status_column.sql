-- Migration: Add status column to deals table if it doesn't exist
-- Run this in your Supabase SQL editor

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add index for status if not exists
CREATE INDEX IF NOT EXISTS deals_status_idx ON deals(status);

-- Also ensure expires_at and updated_at columns exist
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS fetched_at timestamptz;

-- Backfill: set status='active' for any existing rows that have null status
UPDATE deals SET status = 'active' WHERE status IS NULL;
