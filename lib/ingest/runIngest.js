// lib/ingest/runIngest.js
// Single source of truth for deal ingestion.
// Called by:
//   - app/api/cron/refresh-deals/route.js (scheduled)
//   - app/api/ingest/run/route.js (manual from /admin)

import { fetchWalmartDeals }    from '@/lib/feeds/walmart'
import { fetchSlickdealsDeals } from '@/lib/feeds/slickdeals'
import { fetchEDealInfoDeals }  from '@/lib/feeds/edealinfo'
import { fetchDealNewsDeals }   from '@/lib/feeds/dealnews'
import { upsertDeals }          from '@/lib/db/upsertDeals'
import { getSupabaseAdmin }     from '@/lib/db/supabaseAdmin'

export async function runIngest({ triggerType = 'cron' } = {}) {
  const supabase = getSupabaseAdmin()
  if (!supabase) throw new Error('Supabase admin client not initialized — check env vars')

  const startedAt = new Date()
  console.log('[ingest:' + triggerType + '] started at ' + startedAt.toISOString())

  // 1. Expire stale active deals
  const { error: expireError } = await supabase
    .from('deals').update({ status: 'expired' })
    .lt('expires_at', new Date().toISOString()).eq('status', 'active')
  if (expireError) console.error('[ingest:' + triggerType + '] expire error:', expireError)

  // 2. Fetch all 4 sources in parallel
  const [walmartRes, slickdealsRes, edealinfoRes, dealnewsRes] = await Promise.allSettled([
    fetchWalmartDeals(),
    fetchSlickdealsDeals(),
    fetchEDealInfoDeals(),
    fetchDealNewsDeals(),
  ])

  const walmart    = walmartRes.status    === 'fulfilled' ? walmartRes.value    : []
  const slickdeals = slickdealsRes.status === 'fulfilled' ? slickdealsRes.value : []
  const edealinfo  = edealinfoRes.status  === 'fulfilled' ? edealinfoRes.value  : []
  const dealnews   = dealnewsRes.status   === 'fulfilled' ? dealnewsRes.value   : []

  if (walmartRes.status    === 'rejected') console.error('[ingest] walmart failed:',    walmartRes.reason?.message)
  if (slickdealsRes.status === 'rejected') console.error('[ingest] slickdeals failed:', slickdealsRes.reason?.message)
  if (edealinfoRes.status  === 'rejected') console.error('[ingest] edealinfo failed:',  edealinfoRes.reason?.message)
  if (dealnewsRes.status   === 'rejected') console.error('[ingest] dealnews failed:',   dealnewsRes.reason?.message)

  console.log('[ingest:' + triggerType + '] fetched — walmart: ' + walmart.length + ', slickdeals: ' + slickdeals.length + ', edealinfo: ' + edealinfo.length + ', dealnews: ' + dealnews.length)

  // 3. Upsert all sources
  const allDeals = [...walmart, ...slickdeals, ...edealinfo, ...dealnews]
  const { count, new: newCount, refreshed } = allDeals.length
    ? await upsertDeals(allDeals, { status: 'active' })
    : { count: 0, new: 0, refreshed: 0 }

  // 4. Log the run
  const { error: runLogError } = await supabase.from('deal_runs').insert({
    trigger_type: triggerType, status: 'completed',
    started_at: startedAt.toISOString(), finished_at: new Date().toISOString(),
    amazon_count: 0, woot_count: 0, walmart_count: walmart.length,
    total_upserted: count ?? 0,
  })
  if (runLogError) console.error('[ingest:' + triggerType + '] run log error:', runLogError)

  return {
    triggerType,
    walmart: walmart.length, slickdeals: slickdeals.length,
    edealinfo: edealinfo.length, dealnews: dealnews.length,
    total_fetched: allDeals.length,
    pending_upserted: count ?? 0, new: newCount ?? 0, refreshed: refreshed ?? 0,
  }
}
