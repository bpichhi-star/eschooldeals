// app/api/cron/refresh-deals/route.js
//
// Cron schedule (defined in vercel.json):
//   - 09:00 UTC daily → 5am EDT (Mar–Nov) / 4am EST (Nov–Mar)
//   - 19:00 UTC daily → 3pm EDT (Mar–Nov) / 2pm EST (Nov–Mar)
//
// Vercel cron is UTC-only — no way to anchor to ET, so we accept ±1hr
// drift across DST transitions twice a year. Targets the morning ad-drop
// window and the afternoon flash-sale window.
//
// Auth: Vercel automatically sends CRON_SECRET header when firing the cron.
// If CRON_SECRET is not set in env vars, we allow it through with a warning
// so the cron never silently fails due to a missing env var.

import { NextResponse } from 'next/server'
import { runIngest } from '@/lib/ingest/runIngest'

export const runtime    = 'nodejs'
// Bumped 60s → 300s (Vercel Hobby cron max). Best Buy is intentionally
// serialized at ~1.1s per call across 6 categories with pagination, plus
// slickdeals' 3 subfeeds and target's 15 queries — the combined budget
// blew past 60s and the last-running feed kept getting killed mid-flight
// (typically bestbuy-openbox-computers, which was failing every cron run).
export const maxDuration = 300

export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret) {
    // CRON_SECRET is set — validate the header
    const auth = req.headers.get('authorization')
    if (auth !== 'Bearer ' + cronSecret) {
      console.error('[cron] Unauthorized — bad CRON_SECRET header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    // CRON_SECRET not configured — allow through but log a warning
    console.warn('[cron] CRON_SECRET not set in env vars — running without auth check')
  }

  try {
    console.log('[cron] starting ingest at ' + new Date().toISOString())
    // Walmart paused in cron schedule. SerpApi credit conservation; the
    // walmart feed costs ~21 credits per run (one per query) and at 2 runs/day
    // would burn ~1,260 credits/month. Re-evaluate on 2026-05-24 — restore by
    // removing the explicit `sources` arg below to fall back to ALL_SOURCES.
    // Walmart still runnable on-demand via the /admin → "Run Ingest" checkbox.
    const result = await runIngest({
      triggerType: 'cron',
      sources: ['target', 'slickdeals', 'bestbuy'],
    })
    console.log('[cron] completed:', JSON.stringify(result))
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron] fatal error:', err)
    return NextResponse.json({ ok: false, error: err.message || String(err) }, { status: 500 })
  }
}
