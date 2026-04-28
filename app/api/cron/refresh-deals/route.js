// app/api/cron/refresh-deals/route.js
// Runs at 9am UTC (5am ET) and 4pm UTC (12pm ET) daily.
// Auth: Vercel automatically sends CRON_SECRET header when firing the cron.
// If CRON_SECRET is not set in env vars, we allow it through with a warning
// so the cron never silently fails due to a missing env var.

import { NextResponse } from 'next/server'
import { runIngest } from '@/lib/ingest/runIngest'

export const runtime    = 'nodejs'
export const maxDuration = 60

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
    const result = await runIngest({ triggerType: 'cron' })
    console.log('[cron] completed:', JSON.stringify(result))
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron] fatal error:', err)
    return NextResponse.json({ ok: false, error: err.message || String(err) }, { status: 500 })
  }
}
