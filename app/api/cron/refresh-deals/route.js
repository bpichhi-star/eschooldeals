/**
 * GET /api/cron/refresh-deals
 *
 * Called by Vercel Cron daily at 8:00 AM UTC (midnight PT).
 * Protected by CRON_SECRET.
 */

import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin'
import { fetchAmazonDeals } from '@/lib/feeds/amazon'
import { fetchWootDeals } from '@/lib/feeds/woot'
import { upsertDeals, expireOldDeals } from '@/lib/db/upsertDeals'

export const runtime = 'nodejs'
export const maxDuration = 60 // Vercel Pro allows up to 300s; 60s is safe

export async function GET(request) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  let runId = null

  // Create a run record
  try {
    const { data: run } = await supabase
      .from('deal_runs')
      .insert({ trigger_type: 'cron', status: 'running' })
      .select('id')
      .single()
    runId = run?.id
  } catch (_) {}

  const log = []
  let status = 'success'

  try {
    // 1. Expire stale deals first
    const expired = await expireOldDeals()
    log.push(`Expired ${expired} old deals`)

    // 2. Fetch from all sources in parallel
    const [amazonDeals, wootDeals] = await Promise.allSettled([
      fetchAmazonDeals(),
      fetchWootDeals(),
    ])

    const allDeals = [
      ...(amazonDeals.status === 'fulfilled' ? amazonDeals.value : []),
      ...(wootDeals.status === 'fulfilled' ? wootDeals.value : []),
    ]

    if (amazonDeals.status === 'rejected') {
      log.push(`Amazon fetch failed: ${amazonDeals.reason}`)
    }
    if (wootDeals.status === 'rejected') {
      log.push(`Woot fetch failed: ${wootDeals.reason}`)
    }

    log.push(`Fetched ${allDeals.length} total deals`)

    // 3. Cap at 100 deals, ranked by score
    const scored = allDeals
      .filter(d => d.sale_price > 0 && d.product_url)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 100)

    // 4. Upsert to Supabase
    if (scored.length > 0) {
      const result = await upsertDeals(scored, runId)
      log.push(`Upserted ${result.count} deals`)
    } else {
      log.push('No deals to upsert')
    }

  } catch (err) {
    status = 'error'
    log.push(`Fatal error: ${err.message}`)
    console.error('[cron/refresh-deals]', err)
  }

  // Update run record
  if (runId) {
    await supabase
      .from('deal_runs')
      .update({
        status,
        notes: log.join('\n'),
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId)
  }

  return Response.json({ status, log })
}
