// lib/ingest/runIngest.js
import { fetchWalmartDeals }    from '@/lib/feeds/walmart'
import { fetchTargetDeals }     from '@/lib/feeds/target'
import { fetchSlickdealsDeals } from '@/lib/feeds/slickdeals'
import { fetchBestBuyDeals }    from '@/lib/feeds/bestbuy'
import { upsertDeals, expireOldDeals, purgeOldDeals } from '@/lib/db/upsertDeals'
import { getSupabaseAdmin }     from '@/lib/db/supabaseAdmin'

export const ALL_SOURCES = ['walmart', 'target', 'slickdeals', 'bestbuy']

export async function runIngest({ triggerType = 'cron', sources = ALL_SOURCES } = {}) {
  const supabase = getSupabaseAdmin()
  if (!supabase) throw new Error('Supabase admin client not initialized')

  const startedAt = new Date()
  const enabled   = new Set(sources)
  console.log('[ingest:' + triggerType + '] started — sources: ' + [...enabled].join(', '))

  // ── Step 1: Expire deals past midnight ET (hide from site) ──────────────────
  const expired = await expireOldDeals()

  // ── Step 2: Purge deals expired for 7+ days (hard delete from DB) ───────────
  const purged = await purgeOldDeals()

  console.log('[ingest:' + triggerType + '] maintenance — expired: ' + expired + ', purged: ' + purged)

  // ── Step 3: Fetch fresh deals from selected sources ──────────────────────────
  const [walmartRes, targetRes, slickdealsRes, bestbuyRes] = await Promise.allSettled([
    enabled.has('walmart')    ? fetchWalmartDeals()    : Promise.resolve([]),
    enabled.has('target')     ? fetchTargetDeals()     : Promise.resolve([]),
    enabled.has('slickdeals') ? fetchSlickdealsDeals() : Promise.resolve([]),
    enabled.has('bestbuy')    ? fetchBestBuyDeals()    : Promise.resolve([]),
  ])

  const walmart    = walmartRes.status    === 'fulfilled' ? walmartRes.value    : []
  const target     = targetRes.status     === 'fulfilled' ? targetRes.value     : []
  const slickdeals = slickdealsRes.status === 'fulfilled' ? slickdealsRes.value : []
  const bestbuy    = bestbuyRes.status    === 'fulfilled' ? bestbuyRes.value    : []

  if (enabled.has('walmart')    && walmartRes.status    === 'rejected') console.error('[ingest] walmart failed:',    walmartRes.reason?.message)
  if (enabled.has('target')     && targetRes.status     === 'rejected') console.error('[ingest] target failed:',     targetRes.reason?.message)
  if (enabled.has('slickdeals') && slickdealsRes.status === 'rejected') console.error('[ingest] slickdeals failed:', slickdealsRes.reason?.message)
  if (enabled.has('bestbuy')    && bestbuyRes.status    === 'rejected') console.error('[ingest] bestbuy failed:',    bestbuyRes.reason?.message)

  console.log('[ingest:' + triggerType + '] fetched — walmart: ' + walmart.length + ', target: ' + target.length + ', slickdeals: ' + slickdeals.length + ', bestbuy: ' + bestbuy.length)

  // ── Step 4: Upsert new deals ─────────────────────────────────────────────────
  const allDeals = [...walmart, ...target, ...slickdeals, ...bestbuy]
  const { count, new: newCount, refreshed, dupes } = allDeals.length
    ? await upsertDeals(allDeals, { status: 'active' })
    : { count: 0, new: 0, refreshed: 0, dupes: 0 }

  // ── Step 5: Log run ──────────────────────────────────────────────────────────
  await supabase.from('deal_runs').insert({
    trigger_type:   triggerType,
    status:         'completed',
    started_at:     startedAt.toISOString(),
    finished_at:    new Date().toISOString(),
    amazon_count:   0,
    woot_count:     0,
    walmart_count:  walmart.length,
    total_upserted: count ?? 0,
  })

  return {
    triggerType, sources: [...enabled],
    expired, purged,
    walmart: walmart.length, target: target.length,
    slickdeals: slickdeals.length, bestbuy: bestbuy.length,
    total_fetched:    allDeals.length,
    pending_upserted: count ?? 0,
    new:              newCount ?? 0,
    refreshed:        refreshed ?? 0,
    dupes:            dupes ?? 0,
  }
}
