// lib/ingest/runIngest.js
// Single source of truth for deal ingestion.
// Called by:
//   - app/api/cron/refresh-deals/route.js (scheduled — runs all sources)
//   - app/api/ingest/run/route.js (manual from /admin — can pass sources[])

import { fetchWalmartDeals }    from '@/lib/feeds/walmart'
import { fetchSlickdealsDeals } from '@/lib/feeds/slickdeals'
import { fetchEDealInfoDeals }  from '@/lib/feeds/edealinfo'
import { fetchDealNewsDeals }   from '@/lib/feeds/dealnews'
import { upsertDeals }          from '@/lib/db/upsertDeals'
import { getSupabaseAdmin }     from '@/lib/db/supabaseAdmin'

// All available sources — order matters for display
export const ALL_SOURCES = ['walmart', 'slickdeals', 'edealinfo', 'dealnews']

export async function runIngest({ triggerType = 'cron', sources = ALL_SOURCES } = {}) {
  const supabase = getSupabaseAdmin()
  if (!supabase) throw new Error('Supabase admin client not initialized — check env vars')

  const startedAt = new Date()
  const enabled = new Set(sources)
  console.log('[ingest:' + triggerType + '] started at ' + startedAt.toISOString() + ', sources: ' + [...enabled].join(', '))

  // 1. Expire stale active deals
  const { error: expireError } = await supabase
    .from('deals').update({ status: 'expired' })
    .lt('expires_at', new Date().toISOString()).eq('status', 'active')
  if (expireError) console.error('[ingest:' + triggerType + '] expire error:', expireError)

  // 2. Fetch selected sources in parallel
  const fetchers = {
    walmart:    enabled.has('walmart')    ? fetchWalmartDeals()    : Promise.resolve([]),
    slickdeals: enabled.has('slickdeals') ? fetchSlickdealsDeals() : Promise.resolve([]),
    edealinfo:  enabled.has('edealinfo')  ? fetchEDealInfoDeals()  : Promise.resolve([]),
    dealnews:   enabled.has('dealnews')   ? fetchDealNewsDeals()   : Promise.resolve([]),
  }

  const [walmartRes, slickdealsRes, edealinfoRes, dealnewsRes] = await Promise.allSettled([
    fetchers.walmart, fetchers.slickdeals, fetchers.edealinfo, fetchers.dealnews,
  ])

  const walmart    = walmartRes.status    === 'fulfilled' ? walmartRes.value    : []
  const slickdeals = slickdealsRes.status === 'fulfilled' ? slickdealsRes.value : []
  const edealinfo  = edealinfoRes.status  === 'fulfilled' ? edealinfoRes.value  : []
  const dealnews   = dealnewsRes.status   === 'fulfilled' ? dealnewsRes.value   : []

  if (enabled.has('walmart')    && walmartRes.status    === 'rejected') console.error('[ingest] walmart failed:',    walmartRes.reason?.message)
  if (enabled.has('slickdeals') && slickdealsRes.status === 'rejected') console.error('[ingest] slickdeals failed:', slickdealsRes.reason?.message)
  if (enabled.has('edealinfo')  && edealinfoRes.status  === 'rejected') console.error('[ingest] edealinfo failed:',  edealinfoRes.reason?.message)
  if (enabled.has('dealnews')   && dealnewsRes.status   === 'rejected') console.error('[ingest] dealnews failed:',   dealnewsRes.reason?.message)

  console.log('[ingest:' + triggerType + '] fetched — walmart: ' + walmart.length + ', slickdeals: ' + slickdeals.length + ', edealinfo: ' + edealinfo.length + ', dealnews: ' + dealnews.length)

  // 3. Upsert all fetched deals
  const allDeals = [...walmart, ...slickdeals, ...edealinfo, ...dealnews]
  const { count, new: newCount, refreshed } = allDeals.length
    ? await upsertDeals(allDeals, { status: 'active' })
    : { count: 0, new: 0, refreshed: 0 }

  // 4. Log the run
  await supabase.from('deal_runs').insert({
    trigger_type: triggerType, status: 'completed',
    started_at: startedAt.toISOString(), finished_at: new Date().toISOString(),
    amazon_count: 0, woot_count: 0, walmart_count: walmart.length,
    total_upserted: count ?? 0,
  })

  return {
    triggerType,
    sources: [...enabled],
    walmart:          walmart.length,
    slickdeals:       slickdeals.length,
    edealinfo:        edealinfo.length,
    dealnews:         dealnews.length,
    total_fetched:    allDeals.length,
    pending_upserted: count ?? 0,
    new:              newCount ?? 0,
    refreshed:        refreshed ?? 0,
  }
}
