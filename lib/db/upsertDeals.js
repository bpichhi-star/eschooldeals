import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin'

const EXPIRES_IN_DAYS = 7

export async function upsertDeals(deals, opts = {}) {
  const runId          = typeof opts === 'string' ? opts      : opts.runId;
  const statusOverride = typeof opts === 'string' ? undefined : opts.status;

  if (!deals.length) return { count: 0 }

  const supabase  = getSupabaseAdmin()
  const now       = new Date()
  const expiresAt = new Date(now.getTime() + EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Dedupe within the batch by (source_key, product_url) — prevents Supabase conflict error
  const seen = new Set()
  const uniqueDeals = deals.filter(d => {
    const key = (d.source_key || '') + '|' + (d.product_url || '')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const rows = uniqueDeals.map(d => ({
    source_key:          d.source_key,
    merchant:            d.merchant,
    source_type:         d.source_type         ?? 'feed',
    external_id:         d.external_id         ?? null,
    title:               d.title,
    category:            d.category            ?? 'Electronics',
    original_price:      d.original_price      ?? null,
    sale_price:          d.sale_price,
    discount_pct:        d.discount_pct        ?? computeDiscount(d.original_price, d.sale_price),
    product_url:         d.product_url,
    image_url:           d.image_url           ?? null,
    currency:            d.currency            ?? 'USD',
    in_stock:            d.in_stock            ?? true,
    is_student_relevant: d.is_student_relevant ?? false,
    is_featured:         d.is_featured         ?? false,
    score:               d.score               ?? computeScore(d),
    status:              statusOverride ?? d.status ?? 'active',
    fetched_at:          now.toISOString(),
    expires_at:          expiresAt,
    updated_at:          now.toISOString(),
  }))

  const { error } = await supabase
    .from('deals')
    .upsert(rows, { onConflict: 'source_key,product_url', ignoreDuplicates: false })

  if (error) { console.error('[upsertDeals] error:', error.message); throw error }

  if (runId) {
    const rawRows = deals.map(d => ({ run_id: runId, source_key: d.source_key, payload: d._raw ?? {}, fetched_at: now.toISOString() }))
    await supabase.from('deals_raw').insert(rawRows)
  }

  return { count: rows.length }
}

export async function expireOldDeals() {
  const supabase = getSupabaseAdmin()
  const now      = new Date().toISOString()
  const { error, count } = await supabase.from('deals').update({ status: 'expired', updated_at: now }).eq('status', 'active').lt('expires_at', now)
  if (error) console.error('[expireOldDeals] error:', error.message)
  return count ?? 0
}

function computeDiscount(original, sale) {
  if (!original || !sale || original <= 0) return 0
  return Math.round((1 - sale / original) * 100)
}

function computeScore(d) {
  let score = 0
  const pct = d.discount_pct ?? computeDiscount(d.original_price, d.sale_price)
  score += Math.min(pct, 50)
  if (d.image_url)           score += 10
  if (d.in_stock !== false)  score += 10
  if (d.is_student_relevant) score += 20
  return score
}
