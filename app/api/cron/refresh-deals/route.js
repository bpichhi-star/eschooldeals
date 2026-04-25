// app/api/cron/refresh-deals/route.js
// Scheduled daily at 8AM UTC by vercel.json.
// All ingestion logic lives in lib/ingest/runIngest.js — shared with /api/ingest/run.
import { runIngest } from '@/lib/ingest/runIngest'

export const runtime     = 'nodejs'
export const maxDuration = 60

export async function GET(req) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runIngest({ triggerType: 'cron' })
    return Response.json({
      success: true,
      ...result,
      note: 'All deals pending — approve at /admin',
    })
  } catch (err) {
    console.error('[cron] fatal error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
