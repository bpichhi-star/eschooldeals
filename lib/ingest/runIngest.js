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
  //
  // Sequential, not parallel. Reasons:
  //   1. Best Buy enforces a per-second rate limit and serializes its own
  //      calls internally with a 1.1s sleep. When other feeds (slickdeals,
  //      target) ran in parallel via Promise.allSettled, they monopolized
  //      Vercel's request/CPU budget and BB's 1.1s sleeps drifted to 3-5s,
  //      causing whole categories to be cut off by maxDuration.
  //   2. Sequential dispatch also gives us deterministic logs — we know
  //      exactly which feed was running when something broke.
  //
  // Each feed gets ONE retry with a 30s backoff if it throws. Covers
  // transient HTTP 503/504s, network blips, and CDN deploy windows.
  // Two attempts max — beyond that, the feed gets logged and skipped so
  // we don't wedge the whole ingest on one bad source.
  //
  // The captured error message is also written to deal_runs.<source>_error
  // so we can see *why* a feed returned 0 from the SQL log without digging
  // in Vercel runtime logs.
  const feedErrors = { walmart: null, target: null, slickdeals: null, bestbuy: null }
  async function runFeedWithRetry(name, fn) {
    if (!enabled.has(name)) return []
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await fn()
        if (attempt > 1) console.log('[ingest:' + triggerType + '] ' + name + ' succeeded on retry')
        return result
      } catch (e) {
        if (attempt === 1) {
          console.warn('[ingest:' + triggerType + '] ' + name + ' attempt 1 failed: ' + (e?.message || e) + ' — retrying in 30s')
          await new Promise(r => setTimeout(r, 30000))
        } else {
          const msg = e?.message || String(e)
          console.error('[ingest:' + triggerType + '] ' + name + ' failed both attempts:', msg)
          feedErrors[name] = msg.slice(0, 500)  // cap to keep row size sane
          return []
        }
      }
    }
    return []
  }

  // Order matters when budget is tight. Run the slowest / most rate-limit-
  // sensitive feed FIRST so it gets the freshest budget, and the cheapest
  // feed LAST so if anything gets clipped at maxDuration it's the least
  // critical one.
  //   1. Best Buy   — serialized 1.1s/call, 6 categories with pagination
  //   2. Slickdeals — 3 RSS feeds + URL resolver (concurrent, but bounded)
  //   3. Target     — 15 queries via RedSky + ScraperAPI fallback
  //   4. Walmart    — currently disabled in cron route (SerpApi paused)
  const bestbuy    = await runFeedWithRetry('bestbuy',    fetchBestBuyDeals)
  const slickdeals = await runFeedWithRetry('slickdeals', fetchSlickdealsDeals)
  const target     = await runFeedWithRetry('target',     fetchTargetDeals)
  const walmart    = await runFeedWithRetry('walmart',    fetchWalmartDeals)

  console.log('[ingest:' + triggerType + '] fetched — walmart: ' + walmart.length + ', target: ' + target.length + ', slickdeals: ' + slickdeals.length + ', bestbuy: ' + bestbuy.length)

  // ── Step 4: Upsert new deals ─────────────────────────────────────────────────
  // No status override — each feed declares its own intent in d.status.
  // Walmart/Target/BestBuy use 'active' (auto-publish). Slickdeals uses
  // 'pending' (admin reviews via /admin before going live). Forcing 'active'
  // here would silently bypass the slickdeals review queue.
  const allDeals = [...walmart, ...target, ...slickdeals, ...bestbuy]
  const { count, new: newCount, refreshed, dupes } = allDeals.length
    ? await upsertDeals(allDeals)
    : { count: 0, new: 0, refreshed: 0, dupes: 0 }

  // ── Step 5: Log run ──────────────────────────────────────────────────────────
  // Per-source counts let admin see at a glance which feed produced what.
  // Per-source errors capture failures from runFeedWithRetry so we can debug
  // from SQL alone. sources_requested differentiates "feed disabled via env"
  // from "feed ran and got 0" — both look like 0 in count columns alone.
  await supabase.from('deal_runs').insert({
    trigger_type:     triggerType,
    status:           'completed',
    started_at:       startedAt.toISOString(),
    finished_at:      new Date().toISOString(),
    amazon_count:     0,
    woot_count:       0,
    walmart_count:    walmart.length,
    target_count:     target.length,
    slickdeals_count: slickdeals.length,
    bestbuy_count:    bestbuy.length,
    walmart_error:    feedErrors.walmart,
    target_error:     feedErrors.target,
    slickdeals_error: feedErrors.slickdeals,
    bestbuy_error:    feedErrors.bestbuy,
    sources_requested: [...enabled],
    total_upserted:   count ?? 0,
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
