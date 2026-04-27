import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin'

// ─── Expiry ────────────────────────────────────────────────────────────────────
// Deals expire at midnight ET tonight — they are "good for the day."
// The cron runs at 5am ET and 12pm ET to keep the inventory fresh each day.
function endOfDayET() {
  const now = new Date()
  // Get today's date string in ET (MM/DD/YYYY)
  const etStr = now.toLocaleDateString('en-US', { timeZone: 'America/New_York' })
  const [month, day, year] = etStr.split('/')
  // Build midnight ET as a local string, then shift to UTC
  const etLocal = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const etMidnight = new Date(etLocal)
  etMidnight.setHours(23, 59, 59, 999)
  const offsetMs = etLocal.getTime() - now.getTime()
  return new Date(etMidnight.getTime() - offsetMs).toISOString()
}

// Returns true if a fetched_at ISO string is the same calendar day as today in ET
function isAlreadyFetchedTodayET(fetchedAt) {
  if (!fetchedAt) return false
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'short' })
  return formatter.format(new Date(fetchedAt)) === formatter.format(new Date())
}

// ─── Main upsert ───────────────────────────────────────────────────────────────
export async function upsertDeals(deals, opts = {}) {
  const runId        = typeof opts === 'string' ? opts       : opts.runId
  const statusOverride = typeof opts === 'string' ? undefined : opts.status

  if (!deals.length) return { count: 0, new: 0, refreshed: 0, dupes: 0 }

  const supabase = getSupabaseAdmin()
  const now      = new Date()
  const expiresAt = endOfDayET()  // expires at midnight ET tonight

  // Dedup within this batch by source_key + product_url
  const seen = new Set()
  const uniqueDeals = deals.filter(d => {
    const key = (d.source_key || '') + '|' + (d.product_url || '')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Pre-fetch existing rows — include fetched_at so we can detect same-day dupes
  const sourceKeys  = [...new Set(uniqueDeals.map(d => d.source_key))]
  const productUrls = uniqueDeals.map(d => d.product_url).filter(Boolean)
  const existingMap = new Map()

  if (sourceKeys.length && productUrls.length) {
    const { data: existing, error: fetchError } = await supabase
      .from('deals')
      .select('source_key, product_url, status, is_featured, score, fetched_at')
      .in('source_key', sourceKeys)
      .in('product_url', productUrls)
    if (fetchError) {
      console.error('[upsertDeals] pre-fetch error:', fetchError.message)
    } else {
      existing?.forEach(e => existingMap.set(e.source_key + '|' + e.product_url, e))
    }
  }

  // Separate deals into: new, refresh (exists but not today), dupe (already fetched today)
  const toUpsert  = []
  let dupeCount   = 0
  let newCount    = 0
  let refreshCount = 0

  for (const d of uniqueDeals) {
    const key  = d.source_key + '|' + d.product_url
    const prev = existingMap.get(key)

    if (prev && isAlreadyFetchedTodayET(prev.fetched_at)) {
      // Already ingested today — skip, count as dupe
      dupeCount++
      continue
    }

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
      expires_at:          expiresAt,
      updated_at:          now.toISOString(),
    }

    if (prev) {
      // Existing deal from a previous day — preserve admin fields, refresh content
      row.status       = prev.status
      row.is_featured  = prev.is_featured
      row.score        = prev.score
      refreshCount++
    } else {
      // Brand new deal
      row.status       = statusOverride ?? d.status ?? 'active'
      row.is_featured  = d.is_featured ?? false
      row.score        = d.score ?? computeScore(d)
      newCount++
    }

    toUpsert.push(row)
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from('deals')
      .upsert(toUpsert, { onConflict: 'source_key,product_url', ignoreDuplicates: false })
    if (error) {
      console.error('[upsertDeals] error:', error.message)
      throw error
    }
  }

  console.log('[upsertDeals] new: ' + newCount + ', refreshed: ' + refreshCount + ', dupes (skipped): ' + dupeCount + ', expires: ' + expiresAt)

  if (runId && toUpsert.length > 0) {
    const rawRows = toUpsert.map(d => ({
      run_id:     runId,
      source_key: d.source_key,
      payload:    d._raw ?? {},
      fetched_at: now.toISOString(),
    }))
    await supabase.from('deals_raw').insert(rawRows)
  }

  return {
    count:     toUpsert.length,
    new:       newCount,
    refreshed: refreshCount,
    dupes:     dupeCount,
  }
}

// ─── Expire stale deals ────────────────────────────────────────────────────────
export async function expireOldDeals() {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error, count } = await supabase
    .from('deals')
    .update({ status: 'expired', updated_at: now })
    .eq('status', 'active')
    .lt('expires_at', now)
  if (error) console.error('[expireOldDeals] error:', error.message)
  return count ?? 0
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
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
