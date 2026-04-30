import { getSupabaseAdmin, hasSupabaseAdminEnv } from '@/lib/db/supabaseAdmin'

// POST /api/track-click
//
// Body: { id: <deal id> }   — sent by DealCard's onClick beacon when the
//                              user hits "See Deal" on a deal tile.
//
// Behavior: increments deals.click_count by 1 for the matching row.
// Returns 204 No Content on success (response body is ignored by the
// beacon API anyway). Failures are silently swallowed because losing a
// click count is much worse than failing the user's outbound click —
// the beacon fires concurrently with navigation and we never want to
// block it or surface an error.
//
// No rate limiting / dedupe right now. If we see one user spam-clicking
// to game the "Most clicked" sort, we can add session-scoped throttling
// (cookie-based or IP-based) without touching the client side.

export const runtime = 'nodejs'   // Supabase admin client needs Node runtime
export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    if (!hasSupabaseAdminEnv()) {
      return new Response(null, { status: 204 })  // soft-fail when env is missing
    }
    const body = await req.json().catch(() => ({}))
    const id = Number(body?.id)
    if (!id || !Number.isFinite(id) || id <= 0) {
      return new Response(null, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) return new Response(null, { status: 204 })

    // Atomic increment via Postgres expression (no read-modify-write race).
    // Postgres-only — Supabase's JS client maps this to a SQL UPDATE.
    const { error } = await supabase.rpc('increment_click_count', { deal_id: id })
    if (error) {
      // Fallback if the RPC isn't available — race-prone but never blocks UX.
      const { data: row } = await supabase
        .from('deals')
        .select('click_count')
        .eq('id', id)
        .maybeSingle()
      if (row) {
        await supabase
          .from('deals')
          .update({ click_count: (row.click_count ?? 0) + 1 })
          .eq('id', id)
      }
    }
    return new Response(null, { status: 204 })
  } catch (err) {
    // Never let a tracking error bubble up to the client.
    console.error('[track-click] error:', err?.message || err)
    return new Response(null, { status: 204 })
  }
}
