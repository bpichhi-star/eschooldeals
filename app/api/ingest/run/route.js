// app/api/ingest/run/route.js
// Manual ingest trigger — called by the "🔄 Run Ingest Now" button in /admin.
// Uses the same shared logic as the scheduled cron.
//
// Auth: requires Bearer ADMIN_PASSWORD. Falls back to CRON_SECRET so existing
// cron tooling can still hit this if needed. Manual ingest must NEVER be public
// because each call burns SerpApi credits against the monthly quota.
import { runIngest } from '@/lib/ingest/runIngest'

export const runtime     = 'nodejs'
export const maxDuration = 60

function auth(req) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const cronSecret    = process.env.CRON_SECRET
  const header        = req.headers.get('authorization') || ''
  if (adminPassword && header === `Bearer ${adminPassword}`) return true
  if (cronSecret    && header === `Bearer ${cronSecret}`)    return true
  return false
}

async function handle(req) {
  if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await runIngest({ triggerType: 'manual' })
    return Response.json({
      ok:       true,
      ...result,
      // surface count under the legacy keys the UI also reads
      upserted: result.pending_upserted,
      count:    result.pending_upserted,
    })
  } catch (err) {
    console.error('[ingest:manual] fatal error:', err)
    return Response.json(
      { ok: false, triggerType: 'manual', error: err.message || String(err) },
      { status: 500 }
    )
  }
}

export const GET  = handle
export const POST = handle
