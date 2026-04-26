// app/api/cron/refresh-deals/route.js
// Runs at 10am + 5pm UTC via vercel.json.
// Pulls Walmart (SerpApi) + Slickdeals + eDealInfo RSS feeds in parallel.
import { NextResponse }                from 'next/server'
import { upsertDeals, expireOldDeals } from '@/lib/db/upsertDeals'
import { fetchWalmartDeals }           from '@/lib/feeds/walmart'
import { fetchSlickdealsDeals }        from '@/lib/feeds/slickdeals'
import { fetchEDealInfoDeals }         from '@/lib/feeds/edealinfo'

export const runtime     = 'nodejs'
export const maxDuration = 60

export async function GET(req) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runId = `cron-${Date.now()}`
  console.log(`[cron] run ${runId} started`)
  const results = {}

  // Fetch all sources in parallel
  const [walmartRes, slickdealsRes, edealinfoRes] = await Promise.allSettled([
    fetchWalmartDeals(),
    fetchSlickdealsDeals(),
    fetchEDealInfoDeals(),
  ])

  if (walmartRes.status === 'fulfilled' && walmartRes.value.length) {
    results.walmart = await upsertDeals(walmartRes.value, { runId, status: 'active' })
    console.log('[cron] walmart:', results.walmart)
  } else {
    results.walmart = { skipped: true, error: walmartRes.reason?.message }
  }

  if (slickdealsRes.status === 'fulfilled' && slickdealsRes.value.length) {
    results.slickdeals = await upsertDeals(slickdealsRes.value, { runId, status: 'active' })
    console.log('[cron] slickdeals:', results.slickdeals)
  } else {
    results.slickdeals = { skipped: true, error: slickdealsRes.reason?.message }
  }

  if (edealinfoRes.status === 'fulfilled' && edealinfoRes.value.length) {
    results.edealinfo = await upsertDeals(edealinfoRes.value, { runId, status: 'active' })
    console.log('[cron] edealinfo:', results.edealinfo)
  } else {
    results.edealinfo = { skipped: true, error: edealinfoRes.reason?.message }
  }

  results.expired = await expireOldDeals()
  console.log(`[cron] expired ${results.expired} stale deals`)

  return NextResponse.json({ ok: true, runId, results })
}
