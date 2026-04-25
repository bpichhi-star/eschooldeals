import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin'
export const runtime = 'nodejs'

const CJ_PUBLISHER_ID = process.env.CJ_PUBLISHER_ID || '7936037'
const CJ_WOOT_ADVERTISER_ID = process.env.CJ_WOOT_ADVERTISER_ID || '4909784'
const AMAZON_ASSOCIATE_TAG = process.env.AMAZON_ASSOCIATE_TAG || 'eschooldeal0a-20'

// Automatically injects affiliate tracking into known merchant URLs.
// Woot  → wraps with CJ deep-link
// Amazon → appends ?tag= associate tag
// All other URLs pass through unchanged.
function wrapAffiliate(url) {
      if (!url) return url
      try {
              const parsed = new URL(url)
              const host = parsed.hostname

        // --- Woot via CJ deep-link ---
        if (host.includes('woot.com')) {
                  // Already wrapped — don't double-wrap
                if (host.includes('anrdoezrs.net') || host.includes('dpbolvw.net') || host.includes('jdoqocy.com')) return url
                  const encoded = encodeURIComponent(url)
                  return `https://www.anrdoezrs.net/click-${CJ_PUBLISHER_ID}-${CJ_WOOT_ADVERTISER_ID}?url=${encoded}`
        }

        // --- Amazon via associate tag ---
        if (host.includes('amazon.com')) {
                  // Already has our tag — don't overwrite
                if (parsed.searchParams.get('tag') === AMAZON_ASSOCIATE_TAG) return url
                  parsed.searchParams.set('tag', AMAZON_ASSOCIATE_TAG)
                  return parsed.toString()
        }

        return url
      } catch {
              return url
      }
}

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
      let q = supabase.from('deals').select('*').order('score', { ascending: false, nullsFirst: false }).order('fetched_at', { ascending: false }).limit(300)
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
  if (body.product_url) body.product_url = wrapAffiliate(body.product_url)
      const row = { ...body, fetched_at: body.fetched_at||now, updated_at: now, expires_at: body.expires_at||new Date(Date.now()+7*864e5).toISOString(), status: 'active' }
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
