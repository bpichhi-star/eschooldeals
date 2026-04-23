import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin'

export const runtime = 'nodejs'

function auth(request) {
  const h = request.headers.get('authorization') || ''
  return h === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(request) {
  if (!auth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .order('score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  if (!auth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const row = {
    ...body,
    fetched_at: body.fetched_at || now,
    updated_at: now,
    expires_at: body.expires_at || new Date(Date.now() + 7 * 864e5).toISOString(),
    status: 'active',
  }
  const { data, error } = await supabase.from('deals').insert(row).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function PATCH(request) {
  if (!auth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...updates } = await request.json()
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('deals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(request) {
  if (!auth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await request.json()
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('deals').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
