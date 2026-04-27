// app/api/cron/refresh-deals/route.js
// Scheduled via vercel.json — runs at 10am UTC and 5pm UTC daily.
// Uses the same shared runIngest.js as the manual admin trigger,
// so all 5 sources (Walmart, Target, Slickdeals, eDealInfo, DealNews) run automatically.

import { NextResponse } from 'next/server'
import { runIngest } from '@/lib/ingest/runIngest'

export const runtime   = 'nodejs'
export const maxDuration = 60

export async function GET(req) {
  const auth = req.headers.get('authorization')
  if (auth !== 'Bearer ' + process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runIngest({ triggerType: 'cron' })
    console.log('[cron] completed:', JSON.stringify(result))
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron] fatal error:', err)
    return NextResponse.json({ ok: false, error: err.message || String(err) }, { status: 500 })
  }
}
