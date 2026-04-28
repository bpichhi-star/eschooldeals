// app/api/admin/expire/route.js
// Called by the "Clear Expired" button in /admin.
// Marks any active deals past their expires_at as expired,
// and hard-deletes expired deals older than 7 days.

import { expireOldDeals, purgeOldDeals } from '@/lib/db/upsertDeals'

export const runtime = 'nodejs'

function auth(req) {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return true
  const h = req.headers.get('authorization') || ''
  return h === 'Bearer ' + adminPassword
}

export async function POST(req) {
  if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const expired = await expireOldDeals()
    const purged  = await purgeOldDeals()
    return Response.json({ ok: true, expired, purged, count: expired + purged })
  } catch (err) {
    console.error('[admin/expire] error:', err)
    return Response.json({ error: err.message || String(err) }, { status: 500 })
  }
}
