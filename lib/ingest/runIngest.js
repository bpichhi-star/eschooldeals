// lib/ingest/runIngest.js
// Single source of truth for deal ingestion.
// Called by:
//   - app/api/cron/refresh-deals/route.js  (scheduled, auth: CRON_SECRET)
//   - app/api/ingest/run/route.js          (manual from /admin, auth: ADMIN_PASSWORD)
//
// All deals land as status='pending' and are surfaced in /admin for review.
// Nothing goes live without explicit approval.

import { fetchWootSerp }     from '@/lib/feeds/woot-serp'
import { fetchWalmartDeals } from '@/lib/feeds/walmart'
import { upsertDeals }       from '@/lib/db/upsertDeals'
import { getSupabaseAdmin }  from '@/lib/db/supabaseAdmin'

export async function runIngest({ triggerType = 'cron' } = {}) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    throw new Error('Supabase admin client not initialized — check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  }

  const startedAt = new Date()
  console.log(`[ingest:${triggerType}] started at ${startedAt.toISOString()}`)

  // 1. Expire stale active deals
  const { error: expireError } = await supabase
    .from('deals')
    .update({ status: 'expired' })
    .lt('expires_at', new Date().toISOString())
    .eq('status', 'active')
  if (expireError) console.error(`[ingest:${triggerType}] expire error:`, expireError)

  // 2. Fetch all SerpApi sources in parallel
  const [walmartRes, wootSerpRes] = await Promise.allSettled([
    fetchWalmartDeals(),
    fetchWootSerp(),
  ])

  const walmart  = walmartRes.status  === 'fulfilled' ? walmartRes.value  : []
  const wootSerp = wootSerpRes.status === 'fulfilled' ? wootSerpRes.value : []

  if (walmartRes.status  === 'rejected') console.error(`[ingest:${triggerType}] walmart failed:`,   walmartRes.reason)
  if (wootSerpRes.status === 'rejected') console.error(`[ingest:${triggerType}] woot-serp failed:`, wootSerpRes.reason)

  console.log(`[ingest:${triggerType}] fetched — walmart: ${walmart.length}, woot-serp: ${wootSerp.length}`)

  // 3. Upsert as pending
  const allDeals = [...walmart, ...wootSerp]
  const { count } = allDeals.length
    ? await upsertDeals(allDeals, { status: 'pending' })
    : { count: 0 }

  // 4. Log the run. trigger_type is required (NOT NULL in schema). Count columns
  // were added in supabase/migrate_add_deal_runs_columns.sql.
  const { error: runLogError } = await supabase.from('deal_runs').insert({
    trigger_type:   triggerType,
    status:         'completed',
    started_at:     startedAt.toISOString(),
    finished_at:    new Date().toISOString(),
    amazon_count:   0,
    woot_count:     wootSerp.length,
    walmart_count:  walmart.length,
    total_upserted: count ?? 0,
  })
  if (runLogError) console.error(`[ingest:${triggerType}] run log error:`, runLogError)

  return {
    triggerType,
    walmart:          walmart.length,
    'woot-serp':      wootSerp.length,
    pending_upserted: count ?? 0,
    walmart_failed:   walmartRes.status  === 'rejected',
    woot_failed:      wootSerpRes.status === 'rejected',
  }
}
