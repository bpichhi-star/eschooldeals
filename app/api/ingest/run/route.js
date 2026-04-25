import { ingestDeals } from '@/lib/pipeline/ingest'

export const runtime = 'nodejs'
export const maxDuration = 60

// Auth: requires Bearer ADMIN_PASSWORD. If ADMIN_PASSWORD not set, falls back to
// CRON_SECRET (so existing cron tooling still works). If neither is set, blocks
// the request — manual ingest must never be open to the public, since it burns
// SerpApi quota.
function auth(req) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const cronSecret    = process.env.CRON_SECRET
  const header        = req.headers.get('authorization') || ''

  if (adminPassword && header === `Bearer ${adminPassword}`) return true
  if (cronSecret    && header === `Bearer ${cronSecret}`)    return true
  return false
}

async function runManualIngest() {
  const result = await ingestDeals({ triggerType: 'manual' })
  return Response.json({
    ok: true,
    triggerType: 'manual',
    ...result,
  })
}

function errorResponse(error) {
  return Response.json(
    {
      ok: false,
      triggerType: 'manual',
      error: error instanceof Error ? error.message : String(error),
    },
    { status: 500 }
  )
}

export async function GET(req) {
  if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return await runManualIngest()
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(req) {
  if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return await runManualIngest()
  } catch (error) {
    return errorResponse(error)
  }
}
