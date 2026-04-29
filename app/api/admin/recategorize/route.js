// app/api/admin/recategorize/route.js
//
// Re-runs the centralized categorize() function (lib/utils/categorize.js) over
// every deal in the DB and updates rows whose category would change.
//
// Hit this whenever you tune the rules in categorize.js. Idempotent — safe to
// run multiple times. Auth: ADMIN_PASSWORD bearer token, or open if env unset.
//
// GET or POST /api/admin/recategorize  → { ok, scanned, updated, breakdown }

import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin'
import { categorize } from '@/lib/utils/categorize'

export const runtime = 'nodejs'
export const maxDuration = 60

function auth(req) {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return true // open if no password set
  const h = req.headers.get('authorization') || ''
  return h === 'Bearer ' + adminPassword
}

async function run() {
  const supabase = getSupabaseAdmin()

  // Fetch every deal — we need the title to recategorize
  const { data: rows, error: fetchErr } = await supabase
    .from('deals')
    .select('id, title, category')
    .limit(10000)

  if (fetchErr) return { ok: false, error: fetchErr.message }
  if (!rows?.length) return { ok: true, scanned: 0, updated: 0, breakdown: {} }

  // Bucket id lists by their NEW category, only when it differs from current
  const byNew = {}
  let scanned = 0
  for (const row of rows) {
    scanned++
    const newCat = categorize(row.title || '')
    if (newCat === row.category) continue
    if (!byNew[newCat]) byNew[newCat] = []
    byNew[newCat].push(row.id)
  }

  // One UPDATE per destination category
  const breakdown = {}
  let totalUpdated = 0
  for (const [newCat, ids] of Object.entries(byNew)) {
    if (!ids.length) continue
    const { error, count } = await supabase
      .from('deals')
      .update({ category: newCat, updated_at: new Date().toISOString() })
      .in('id', ids)
    if (error) {
      console.error('[recategorize] error updating →' + newCat + ':', error.message)
      breakdown[newCat] = { error: error.message, attempted: ids.length }
      continue
    }
    breakdown[newCat] = count ?? ids.length
    totalUpdated += count ?? ids.length
  }

  return { ok: true, scanned, updated: totalUpdated, breakdown }
}

export async function GET(req)  {
  if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  return Response.json(await run())
}
export async function POST(req) {
  if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  return Response.json(await run())
}
