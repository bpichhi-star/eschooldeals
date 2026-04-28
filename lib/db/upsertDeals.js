import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin'

// ─── Lifecycle ────────────────────────────────────────────────────────────────
//
//  ACTIVE   → shown on site, fetched today
//  EXPIRED  → past midnight ET, hidden from site, kept 7 days as archive
//  PURGED   → hard-deleted after 7 days, gone forever
//
//  Timeline per deal:
//    Ingested 5am ET  → status: active, expires_at: midnight ET tonight
//    Midnight ET      → status flips to expired, hidden from site
//    +7 days          → hard-deleted from DB (purged)
//
//  If the same deal comes back in tomorrow's ingest → reset to active for today
// ─────────────────────────────────────────────────────────────────────────────

// Midnight ET tonight
function endOfDayET() {
  const now    = new Date()
  const etNow  = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const etMid  = new Date(etNow)
  etMid.setHours(23, 59, 59, 999)
  const offsetMs = etNow.getTime() - now.getTime()
  return new Date(etMid.getTime() - offsetMs).toISOString()
}

// Same calendar day in ET?
function isAlreadyFetchedTodayET(fetchedAt) {
  if (!fetchedAt) return false
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'short' })
  return fmt.format(new Date(fetchedAt)) === fmt.format(new Date())
}

// ─── Upsert ───────────────────────────────────────────────────────────────────
export async function upsertDeals(deals, opts = {}) {
  const runId          = typeof opts === 'string' ? opts       : opts.runId
  const statusOverride = typeof opts === 'string' ? undefined  : opts.status

  if (!deals.length) return { count: 0, new: 0, refreshed: 0, dupes: 0 }

  const supabase  = getSupabaseAdmin()
  const now       = new Date()
  const expiresAt = endOfDayET()

  // Batch-level dedup by source_key + product_url
  const seen = new Set()
  const uniqueDeals = deals.filter(d => {
    const key = (d.source_key || '') + '|' + (d.product_url || '')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Pre-fetch existing rows (need fetched_at, status, is_featured, score)
  const sourceKeys  = [...new Set(uniqueDeals.map(d => d.source_key))]
  const productUrls = uniqueDeals.map(d => d.product_url).filter(Boolean)
  const existingMap = new Map()

  if (sourceKeys.length && productUrls.length) {
    const { data: existing, error } = await supabase
      .from('deals')
      .select('source_key, product_url, status, is_featured, score, fetched_at')
      .in('source_key', sourceKeys)
      .in('product_url', productUrls)
    if (error) console.error('[upsertDeals] pre-fetch error:', error.message)
    else existing?.forEach(e => existingMap.set(e.source_key + '|' + e.product_url, e))
  }

  const toUpsert = []
  let newCount = 0, refreshCount = 0, dupeCount = 0

  for (const d of uniqueDeals) {
    const key  = d.source_key + '|' + d.product_url
    const prev = existingMap.get(key)

    // Already ingested today → skip
    if (prev && isAlreadyFetchedTodayET(prev.fetched_at)) { dupeCount++; continue }

    const row = {
      source_key:          d.source_key,
      merchant:            d.merchant,
      source_type:         d.source_type ?? 'feed',
      external_id:         d.external_id ?? null,
      title:               d.title,
      category:            d.category ?? 'Electronics',
      original_price:      d.original_price ?? null,
      sale_price:          d.sale_price,
      discount_pct:        d.discount_pct ?? computeDiscount(d.original_price, d.sale_price),
      product_url:         d.product_url,
      image_url:           d.image_url ?? null,
      currency:            d.currency ?? 'USD',
      in_stock:            d.in_stock ?? true,
      is_student_relevant: d.is_student_relevant ?? false,
      fetched_at:          now.toISOString(),
      expires_at:          expiresAt,   // midnight ET tonight
      updated_at:          now.toISOString(),
    }

    if (prev) {
      // Deal seen before — reset to active for today (could have been expired yesterday)
      // Preserve admin-set fields: is_featured, score
      row.status      = 'active'          // always re-activate if it's back today
      row.is_featured = prev.is_featured
      row.score       = prev.score
      refreshCount++
    } else {
      row.status      = statusOverride ?? d.status ?? 'active'
      row.is_featured = d.is_featured ?? false
      row.score       = d.score ?? computeScore(d)
      newCount++
    }

    toUpsert.push(row)
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from('deals')
      .upsert(toUpsert, { onConflict: 'source_key,product_url', ignoreDuplicates: false })
    if (error) { console.error('[upsertDeals] error:', error.message); throw error }
  }

  console.log('[upsertDeals] new: ' + newCount + ', refreshed: ' + refreshCount + ', dupes skipped: ' + dupeCount + ', expires: ' + expiresAt)

  if (runId && toUpsert.length > 0) {
    await supabase.from('deals_raw').insert(
      toUpsert.map(d => ({ run_id: runId, source_key: d.source_key, payload: d._raw ?? {}, fetched_at: now.toISOString() }))
    )
  }

  return { count: toUpsert.length, new: newCount, refreshed: refreshCount, dupes: dupeCount }
}

// ─── Step 1: Expire deals past midnight ET ────────────────────────────────────
// Marks active deals as expired so they disappear from the site.
// Runs at start of every ingest.
export async function expireOldDeals() {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error, count } = await supabase
    .from('deals')
    .update({ status: 'expired', updated_at: now })
    .eq('status', 'active')
    .lt('expires_at', now)
  if (error) console.error('[expireOldDeals] error:', error.message)
  const expired = count ?? 0
  if (expired > 0) console.log('[expireOldDeals] marked ' + expired + ' deals as expired')
  return expired
}

// ─── Step 2: Purge deals expired for 7+ days ─────────────────────────────────
// Hard-deletes expired rows older than 7 days from the DB entirely.
// Keeps a rolling 7-day archive of expired deals for reference.
// Runs at start of every ingest.
export async function purgeOldDeals() {
  const supabase = getSupabaseAdmin()
  const cutoff   = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { error, count } = await supabase
    .from('deals')
    .delete()
    .eq('status', 'expired')
    .lt('expires_at', cutoff)
  if (error) console.error('[purgeOldDeals] error:', error.message)
  const purged = count ?? 0
  if (purged > 0) console.log('[purgeOldDeals] hard-deleted ' + purged + ' deals (expired >7 days ago)')
  return purged
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
