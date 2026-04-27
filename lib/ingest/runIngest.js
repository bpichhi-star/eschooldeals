// lib/ingest/runIngest.js
import { fetchWalmartDeals }    from '@/lib/feeds/walmart'
import { fetchTargetDeals }     from '@/lib/feeds/target'
import { fetchSlickdealsDeals } from '@/lib/feeds/slickdeals'
import { fetchEDealInfoDeals }  from '@/lib/feeds/edealinfo'
import { fetchDealNewsDeals }   from '@/lib/feeds/dealnews'
import { upsertDeals }          from '@/lib/db/upsertDeals'
import { getSupabaseAdmin }     from '@/lib/db/supabaseAdmin'

export const ALL_SOURCES = ['walmart', 'target', 'slickdeals', 'edealinfo', 'dealnews']

export async function runIngest({ triggerType = 'cron', sources = ALL_SOURCES } = {}) {
  const supabase = getSupabaseAdmin()
  if (!supabase) throw new Error('Supabase admin client not initialized — check env vars')

  const startedAt = new Date()
  const enabled   = new Set(sources)
  console.log('[ingest:' + triggerType + '] started — sources: ' + [...enabled].join(', '))

  // 1. Expire stale deals
  const { error: expireError } = await supabase
    .from('deals').update({ status: 'expired' })
    .lt('expires_at', new Date().toISOString()).eq('status', 'active')
  if (expireError) console.error('[ingest] expire error:', expireError)

  // 2. Fetch selected sources in parallel
  const [walmartRes, targetRes, slickdealsRes, edealinfoRes, dealnewsRes] = await Promise.allSettled([
    enabled.has('walmart')    ? fetchWalmartDeals()    : Promise.resolve([]),
    enabled.has('target')     ? fetchTargetDeals()     : Promise.resolve([]),
    enabled.has('slickdeals') ? fetchSlickdealsDeals() : Promise.resolve([]),
    enabled.has('edealinfo')  ? fetchEDealInfoDeals()  : Promise.resolve([]),
    enabled.has('dealnews')   ? fetchDealNewsDeals()   : Promise.resolve([]),
  ])

  const walmart    = walmartRes.status    === 'fulfilled' ? walmartRes.value    : []
  const target     = targetRes.status     === 'fulfilled' ? targetRes.value     : []
  const slickdeals = slickdealsRes.status === 'fulfilled' ? slickdealsRes.value : []
  const edealinfo  = edealinfoRes.status  === 'fulfilled' ? edealinfoRes.value  : []
  const dealnews   = dealnewsRes.status   === 'fulfilled' ? dealnewsRes.value   : []

  if (enabled.has('walmart')    && walmartRes.status    === 'rejected') console.error('[ingest] walmart failed:',    walmartRes.reason?.message)
  if (enabled.has('target')     && targetRes.status     === 'rejected') console.error('[ingest] target failed:',     targetRes.reason?.message)
  if (enabled.has('slickdeals') && slickdealsRes.status === 'rejected') console.error('[ingest] slickdeals failed:', slickdealsRes.reason?.message)
  if (enabled.has('edealinfo')  && edealinfoRes.status  === 'rejected') console.error('[ingest] edealinfo failed:',  edealinfoRes.reason?.message)
  if (enabled.has('dealnews')   && dealnewsRes.status   === 'rejected') console.error('[ingest] dealnews failed:',   dealnewsRes.reason?.message)

  console.log('[ingest:' + triggerType + '] fetched — walmart: ' + walmart.length + ', target: ' + target.length + ', slickdeals: ' + slickdeals.length + ', edealinfo: ' + edealinfo.length + ', dealnews: ' + dealnews.length)

  // 3. Upsert
  const allDeals = [...walmart, ...target, ...slickdeals, ...edealinfo, ...dealnews]
  const { count, new: newCount, refreshed } = allDeals.length
    ? await upsertDeals(allDeals, { status: 'active' })
    : { count: 0, new: 0, refreshed: 0 }

  // 4. Log run
  await supabase.from('deal_runs').insert({
    trigger_type: triggerType, status: 'completed',
    started_at: startedAt.toISOString(), finished_at: new Date().toISOString(),
    amazon_count: 0, woot_count: 0, walmart_count: walmart.length,
    total_upserted: count ?? 0,
  })

  return {
    triggerType, sources: [...enabled],
    walmart: walmart.length, target: target.length,
    slickdeals: slickdeals.length, edealinfo: edealinfo.length, dealnews: dealnews.length,
    total_fetched: allDeals.length,
    pending_upserted: count ?? 0, new: newCount ?? 0, refreshed: refreshed ?? 0,
  }
}
