// app/api/ingest/run/route.js
// Manual ingest trigger — called by the "Run Ingest Now" button in /admin.
// Accepts optional 'sources' array in the POST body to run specific feeds only.
// Auth: requires Bearer ADMIN_PASSWORD (falls back to CRON_SECRET).

import { runIngest, ALL_SOURCES } from '@/lib/ingest/runIngest'

export const runtime = 'nodejs'
export const maxDuration = 60

function auth(req) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const cronSecret    = process.env.CRON_SECRET
  const header        = req.headers.get('authorization') || ''
  if (adminPassword && header === 'Bearer ' + adminPassword) return true
  if (cronSecret    && header === 'Bearer ' + cronSecret)    return true
  return false
}

async function handle(req) {
  if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Parse optional sources from POST body
  let sources = ALL_SOURCES
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      if (Array.isArray(body.sources) && body.sources.length > 0) {
        // Validate — only allow known source names
        sources = body.sources.filter(s => ALL_SOURCES.includes(s))
        if (sources.length === 0) {
          return Response.json({ error: 'No valid sources specified. Valid: ' + ALL_SOURCES.join(', ') }, { status: 400 })
        }
      }
    } catch { /* no body or not JSON — use all sources */ }
  }

  try {
    const result = await runIngest({ triggerType: 'manual', sources })
    return Response.json({
      ok: true,
      ...result,
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
