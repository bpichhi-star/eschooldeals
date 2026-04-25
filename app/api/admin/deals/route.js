import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin'
export const runtime = 'nodejs'

function auth(req) { return (req.headers.get('authorization')||'') === `Bearer ${process.env.CRON_SECRET}` }

// GET /api/admin/deals?status=pending|active|all
export async function GET(req) {
  if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const status   = new URL(req.url).searchParams.get('status') || 'all'
  const supabase = getSupabaseAdmin()
  let q = supabase.from('deals').select('*').order('score', { ascending: false, nullsFirst: false }).order('fetched_at', { ascending: false }).limit(300)
  if (status !== 'all') q = q.eq('status', status)
  const { data, error } = await q
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

// POST — manual deal (always active)
export async function POST(req) {
  if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const row = { ...body, fetched_at: body.fetched_at||now, updated_at: now, expires_at: body.expires_at||new Date(Date.now()+7*864e5).toISOString(), status: 'active' }
  const { data, error } = await supabase.from('deals').insert(row).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

// PATCH — approve (status:'active'), reject (status:'expired'), or edit
export async function PATCH(req) {
  if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...updates } = await req.json()
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('deals').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

// DELETE — hard delete
export async function DELETE(req) {
  if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('deals').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
