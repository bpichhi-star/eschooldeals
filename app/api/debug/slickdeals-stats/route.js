import { fetchSlickdealsDealsWithStats } from '@/lib/feeds/slickdeals'

// GET /api/debug/slickdeals-stats
//
// Runs the full slickdeals ingest with instrumentation and returns where
// every dropped item is being filtered out. Used during diagnostics — not
// wired into the cron path.
//
// Drop reason codes documented in lib/feeds/slickdeals.js parseItem.
//
// Cron runs ~12s typical; this can take longer if many click resolutions
// time out, hence maxDuration=60.

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  const start = Date.now()
  const { perFeed, dedupKept, dedupDropped } = await fetchSlickdealsDealsWithStats()

  // Aggregate drop reasons across all feeds
  const totalReasons = {}
  let totalItems = 0
  let totalKept  = 0
  for (const f of perFeed) {
    totalItems += f.totalItems
    totalKept  += f.kept.length
    for (const r of f.drops) {
      totalReasons[r] = (totalReasons[r] || 0) + 1
    }
  }
  const totalDropped = totalItems - totalKept

  // Per-feed summary
  const feedSummary = perFeed.map(f => {
    const reasons = {}
    for (const r of f.drops) reasons[r] = (reasons[r] || 0) + 1
    return {
      feed:       f.label,
      total:      f.totalItems,
      kept:       f.kept.length,
      dropped:    f.drops.length,
      reasons,
    }
  })

  return Response.json({
    elapsed_ms:    Date.now() - start,
    summary: {
      total_items_in_rss: totalItems,
      kept_pre_dedup:     totalKept,
      kept_post_dedup:    dedupKept.length,
      dropped_filters:    totalDropped,
      dropped_dedup:      dedupDropped,
      retention_pct:      totalItems > 0 ? Math.round((dedupKept.length / totalItems) * 100) : 0,
    },
    drop_reasons: totalReasons,
    drop_reason_legend: {
      no_title:         'RSS item had no <title> tag',
      blocklist:        'Title matched pet/baby/automotive/etc. blocklist',
      vague_title:      '"and much more" / "various items" — multi-deal aggregator title',
      exit_woot:        'data-product-exitWebsite hint says woot.com (CJ Woot inactive)',
      no_click_url:     'No slickdeals.net/click URL found in description HTML',
      resolve_failed:   'slickdeals click handler did not return a Location (timeout or 200)',
      still_wrapped:    'Resolved URL is on an affiliate redirect we cannot unwrap',
      aggregator:       'Resolved URL is on another deals aggregator',
      skipped_merchant: 'Resolved to a merchant we explicitly skip (woot, etc.)',
      no_product_url:   'buildAffiliateUrl returned null',
      no_price:         'Could not extract a $X.XX from the title',
      exception:        'Uncaught error during parse',
    },
    per_feed: feedSummary,
  })
}
