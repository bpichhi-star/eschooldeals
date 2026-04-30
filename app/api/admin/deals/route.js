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
      // Auto-compute discount_pct when both prices are set (matches edit-modal behavior).
      // Skip if caller already provided discount_pct (lets feeds keep their canonical value).
      if (body.discount_pct == null && body.sale_price != null && body.original_price != null) {
        const s = Number(body.sale_price), o = Number(body.original_price)
        body.discount_pct = (o > 0 && s > 0 && s < o) ? Math.round((1 - s / o) * 100) : 0
      }
      // Default expires_at:
      //   - admin-curated (is_featured=true OR source_key='manual') → NULL (evergreen).
      //     Admin must set a real expiration date later if the offer has one.
      //     The time-based sweep (.lt('expires_at', now)) doesn't match NULL, so
      //     these deals stay active until admin marks them expired or sets a date.
      //   - Everything else (admin adding a feed-style deal) → midnight ET tonight.
      const isAdminCurated = body.is_featured === true || body.source_key === 'manual'
      let expiresAt
      if (body.expires_at !== undefined) {
        expiresAt = body.expires_at  // honor admin-provided value (including null)
      } else if (isAdminCurated) {
        expiresAt = null
      } else {
        const _now    = new Date()
        const etNow  = new Date(_now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
        const etMid  = new Date(etNow)
        etMid.setHours(23, 59, 59, 999)
        const offsetMs = etNow.getTime() - _now.getTime()
        expiresAt = new Date(etMid.getTime() - offsetMs).toISOString()
      }
      const row = { ...body, fetched_at: body.fetched_at||now, updated_at: now, expires_at: expiresAt, status: 'active' }
      const { data, error } = await supabase.from('deals').insert(row).select().single()
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json(data)
}

export async function PATCH(req) {
      if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
      const { id, ...updates } = await req.json()
      if (!id) return Response.json({ error: 'id required' }, { status: 400 })
      // Auto-inject affiliate tracking if URL is being edited (matches POST behavior).
      // buildAffiliateUrl is idempotent for already-wrapped Amazon/Woot/Walmart URLs.
      if (updates.product_url) updates.product_url = buildAffiliateUrl(updates.product_url)
      // When admin promotes a deal to featured, clear its expires_at to NULL
      // (evergreen) UNLESS admin explicitly provided expires_at in the same
      // PATCH. This prevents a feed-style midnight-tonight expires_at from
      // wiping the deal off the strip overnight. Admin can later set a real
      // expiration date with another PATCH.
      if (updates.is_featured === true && updates.expires_at === undefined) {
        updates.expires_at = null
      }
      // When admin reactivates a deal whose expires_at is in the past,
      // clear it (NULL = evergreen) so the deal doesn't immediately re-expire
      // on the next sweep. Admin can set a real expiration if they have one.
      if (updates.status === 'active' && updates.expires_at === undefined) {
        const supabaseRead = getSupabaseAdmin()
        const { data: existing } = await supabaseRead
          .from('deals')
          .select('expires_at')
          .eq('id', id)
          .single()
        if (existing?.expires_at && new Date(existing.expires_at) < new Date()) {
          updates.expires_at = null
        }
      }
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
