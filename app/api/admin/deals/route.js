import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin'
import { buildAffiliateUrl } from '@/lib/utils/affiliateUrl'
export const runtime = 'nodejs'

// Uses ADMIN_PASSWORD env var. If not set, admin is open (no auth required).
function auth(req) {
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminPassword) return true; // open access if no password configured
  const h = req.headers.get('authorization') || '';
      return h === `Bearer ${adminPassword}`;
}

export async function GET(req) {
      if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
      const status = new URL(req.url).searchParams.get('status') || 'all'
      const supabase = getSupabaseAdmin()
      let q = supabase.from('deals').select('*').order('discount_pct', { ascending: false, nullsFirst: false }).order('fetched_at', { ascending: false }).limit(2000)
      if (status !== 'all') q = q.eq('status', status)
      const { data, error } = await q
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json(data)
}

export async function POST(req) {
      if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
      const body = await req.json()
      const supabase = getSupabaseAdmin()
      const now = new Date().toISOString()
      // Auto-inject affiliate tracking before storing
  if (body.product_url) body.product_url = buildAffiliateUrl(body.product_url)
      const row = { ...body, fetched_at: body.fetched_at||now, updated_at: now, expires_at: body.expires_at || (() => {
      // Expire at midnight ET tonight — consistent with ingest pipeline
      const now    = new Date()
      const etNow  = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const etMid  = new Date(etNow)
      etMid.setHours(23, 59, 59, 999)
      const offsetMs = etNow.getTime() - now.getTime()
      return new Date(etMid.getTime() - offsetMs).toISOString()
    })(), status: 'active' }
      const { data, error } = await supabase.from('deals').insert(row).select().single()
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json(data)
}

export async function PATCH(req) {
      if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
      const { id, ...updates } = await req.json()
      if (!id) return Response.json({ error: 'id required' }, { status: 400 })
      const supabase = getSupabaseAdmin()
      const { data, error } = await supabase.from('deals').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json(data)
}

export async function DELETE(req) {
      if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
      const { id } = await req.json()
      if (!id) return Response.json({ error: 'id required' }, { status: 400 })
      const supabase = getSupabaseAdmin()
      const { error } = await supabase.from('deals').delete().eq('id', id)
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true })
}
