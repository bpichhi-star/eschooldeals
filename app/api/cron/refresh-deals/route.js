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
// Auth: CRON_SECRET must be set in env vars; the route fails closed (401)
// if it's missing. Vercel automatically sends the secret as a Bearer
// header when firing scheduled crons, so production never sees this 401
// unless someone misconfigures env vars or hits the URL by hand.
//
// Source selection: defaults to ALL_SOURCES; can be narrowed via env.
//   CRON_DISABLE_SOURCES=walmart           → run everything except walmart
//   CRON_DISABLE_SOURCES=walmart,target    → run everything except those two
// This makes the production override visible in the Vercel dashboard
// instead of buried in code, and lets us re-enable a paused source by
// editing one env var (no redeploy needed for the next cron tick).

import { NextResponse } from 'next/server'
import { runIngest, ALL_SOURCES } from '@/lib/ingest/runIngest'

export const runtime    = 'nodejs'
// Bumped 60s → 300s (Vercel Hobby cron max). Best Buy is intentionally
// serialized at ~1.1s per call across 6 categories with pagination, plus
// slickdeals' 3 subfeeds and target's 15 queries — the combined budget
// blew past 60s and the last-running feed kept getting killed mid-flight
// (typically bestbuy-openbox-computers, which was failing every cron run).
export const maxDuration = 300

export async function GET(req) {
  // ── Auth: fail closed ──────────────────────────────────────────────────────
  // Previously this branch fell through with a console.warn when CRON_SECRET
  // was missing — meaning anyone who knew the URL could trigger a full ingest
  // cycle anonymously. Now we always require the header. Vercel's scheduled
  // cron runs send the right Bearer header automatically; manual triggers
  // need ADMIN_PASSWORD via /admin → Run Ingest (different endpoint).
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron] CRON_SECRET not set in env vars — refusing to run')
    return NextResponse.json(
      { error: 'CRON_SECRET not configured on server' },
      { status: 500 }
    )
  }
  const auth = req.headers.get('authorization')
  if (auth !== 'Bearer ' + cronSecret) {
    console.error('[cron] Unauthorized — bad or missing CRON_SECRET header')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Source selection via env var (visible override, no redeploy) ───────────
  const disabledRaw = process.env.CRON_DISABLE_SOURCES || ''
  const disabled = new Set(
    disabledRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  )
  const sources = ALL_SOURCES.filter(s => !disabled.has(s))

  try {
    console.log('[cron] starting ingest at ' + new Date().toISOString() +
                (disabled.size ? ' — disabled: ' + [...disabled].join(',') : ''))
    const result = await runIngest({ triggerType: 'cron', sources })
    console.log('[cron] completed:', JSON.stringify(result))
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron] fatal error:', err)
    return NextResponse.json({ ok: false, error: err.message || String(err) }, { status: 500 })
  }
}
