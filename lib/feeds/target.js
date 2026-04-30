// lib/feeds/target.js
//
// Pulls deals from Target via their internal RedSky aggregations API.
// RedSky is the same API that powers target.com search — undocumented but
// stable for years. No auth needed beyond a public web key (rotates rarely).
//
// Strategy:
//   1. Try direct fetch from Vercel first (free, 0 credits)
//   2. Fall back to ScraperAPI passthrough only when direct returns
//      403/429/503 (1 credit/req)
//   3. Premium proxy mode NOT used — protects the credit budget cap
//
// Queries are run SERIALLY with a 1.2s gap between them. RedSky throttles
// burst traffic from a single IP — running all 15 queries via Promise.all
// caused most to fail with 400/429, then fall through to ScraperAPI which
// also rate-limits parallel requests on the free tier. Serializing fits
// well within the 300s cron budget (15 × ~2s = ~30s wall time).
//
// Budget: ~15 queries × 2 cron/day × 30 days × ~0 credits (when direct
// works) = 0/month expected. ScraperAPI only fires on direct failures.
// Free tier is 5,000/month; current usage <1%.

import { categorize, mapExternalCategory } from '@/lib/utils/categorize'
import { buildAffiliateUrl } from '@/lib/utils/affiliateUrl'

const SCRAPERAPI_KEY = process.env.SCRAPERAPI_KEY

// Public RedSky web key — Target rotates this occasionally. If queries start
// returning 401/403, check target.com network requests for the current value.
const REDSKY_KEY = '9f36aeafbe60771e321a7cc95a78140772ab3e96'

const BROWSER_HEADERS = {
  'User-Agent':     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':         'application/json',
  'Accept-Language':'en-US,en;q=0.9',
  'Origin':         'https://www.target.com',
  'Referer':        'https://www.target.com/',
}

const FETCH_TIMEOUT_MS = 15000     // RedSky usually responds in 1-2s; 15s is generous
const SERIAL_DELAY_MS  = 1200      // gap between queries to avoid IP throttle
const STORE_ID         = '3991'
const MIN_SALE_PRICE   = 5
const MIN_DISCOUNT_PCT = 10
const MIN_REVIEW_COUNT = 5
const PER_QUERY_LIMIT  = 24

// ─── Student-relevant queries ─────────────────────────────────────────────────
const QUERIES_BASE = [
  { q: 'student laptop',           category: 'Computers',   max: 800,  student: true  },
  { q: 'Chromebook',               category: 'Computers',   max: 400,  student: true  },
  { q: 'wireless earbuds',         category: 'Electronics', max: 100,  student: true  },
  { q: 'over-ear headphones',      category: 'Electronics', max: 150,  student: true  },
  { q: 'noise cancelling headphones', category: 'Electronics', max: 200, student: true },
  { q: 'portable charger',         category: 'Accessories', max: 60,   student: true  },
  { q: 'laptop backpack',          category: 'Accessories', max: 80,   student: true  },
  { q: 'usb-c hub',                category: 'Accessories', max: 50,   student: true  },
  { q: 'desk lamp',                category: 'Home',        max: 50,   student: true  },
  { q: 'mini fridge',              category: 'Home',        max: 250,  student: true  },
  { q: 'twin xl bedding',          category: 'Home',        max: 100,  student: true  },
  { q: 'dorm storage bins',        category: 'Home',        max: 40,   student: true  },
  { q: 'shower caddy',             category: 'Home',        max: 30,   student: true  },
  { q: 'desk organizer',           category: 'Home',        max: 35,   student: true  },
  { q: 'monitor 24 inch',          category: 'Electronics', max: 250,  student: true  },
]

// Back-to-school seasonal — activates July 15 → September 15
const QUERIES_SEASONAL = [
  { q: 'back to college',          category: 'Home',        max: 100,  student: true  },
  { q: 'dorm essentials',          category: 'Home',        max: 80,   student: true  },
  { q: 'dorm room decor',          category: 'Home',        max: 60,   student: true  },
  { q: 'school supplies',          category: 'Accessories', max: 30,   student: true  },
  { q: 'laundry basket dorm',      category: 'Home',        max: 30,   student: true  },
]

function isBackToSchoolSeason() {
  const now   = new Date()
  const month = now.getUTCMonth() + 1
  const day   = now.getUTCDate()
  if (month === 7 && day >= 15) return true
  if (month === 8) return true
  if (month === 9 && day <= 15) return true
  return false
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchWithTimeout(url, opts = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, cache: 'no-store' })
  } finally {
    clearTimeout(t)
  }
}

// IMPORTANT — DO NOT manually encodeURIComponent values here.
// URLSearchParams.toString() already encodes every value, so doing it
// twice produces double-encoded params (e.g. spaces become %2520 instead
// of %20) and RedSky returns HTTP 400. The previous version of this
// file had `page: '/s/' + encodeURIComponent(query)` which silently
// killed every query whose keyword had a space — i.e. most of them.
//
// Also dropped pricing_story=sale: RedSky 400s on it for some keywords
// (testing showed it's the difference between "wireless earbuds" → 400
// and "wireless earbuds" without the param → 200). The MIN_DISCOUNT_PCT
// filter below catches non-sale items anyway.
function buildRedskyUrl(query) {
  const params = new URLSearchParams({
    key:                          REDSKY_KEY,
    channel:                      'WEB',
    count:                        String(PER_QUERY_LIMIT),
    default_purchasability_filter:'true',
    include_sponsored:            'false',
    keyword:                      query,
    new_search:                   'true',
    offset:                       '0',
    page:                         '/s/' + query,   // raw — URLSearchParams encodes
    platform:                     'desktop',
    pricing_store_id:             STORE_ID,
    spellcheck:                   'true',
    store_ids:                    STORE_ID,
    visitor_id:                   '0181E1A3F3000201A1AB2BC68DD75A92',
  })
  return 'https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2?' + params.toString()
}

// ─── Multi-strategy fetch ─────────────────────────────────────────────────────
async function fetchRedsky(query) {
  const targetUrl = buildRedskyUrl(query)

  // Strategy 1: direct fetch from Vercel (free)
  try {
    const res = await fetchWithTimeout(targetUrl, { headers: BROWSER_HEADERS })
    if (res.ok) {
      const data = await res.json()
      return { data, strategy: 'direct', credits: 0 }
    }
    // Only fall back to paid proxy on signals that direct itself failed
    // (block / throttle). Other status codes (400/404/500) are likely
    // request-shape problems that ScraperAPI won't fix either.
    if (res.status !== 403 && res.status !== 429 && res.status !== 503) {
      console.warn('[target] direct ' + res.status + ' for "' + query + '" — not retrying via scraperapi')
      return null
    }
    console.warn('[target] direct ' + res.status + ' for "' + query + '" — falling back to scraperapi')
  } catch (e) {
    console.warn('[target] direct error for "' + query + '": ' + e.message + ' — falling back to scraperapi')
  }

  // Strategy 2: ScraperAPI passthrough (1 credit per call)
  if (!SCRAPERAPI_KEY) {
    console.warn('[target] direct blocked, SCRAPERAPI_KEY not set — skipping query')
    return null
  }

  const scraperUrl = 'https://api.scraperapi.com/?api_key=' + SCRAPERAPI_KEY
                   + '&url=' + encodeURIComponent(targetUrl)
                   + '&keep_headers=true'
  try {
    const res = await fetchWithTimeout(scraperUrl, { headers: BROWSER_HEADERS }, 35000)
    if (res.ok) {
      const data = await res.json()
      return { data, strategy: 'scraperapi', credits: 1 }
    }
    console.warn('[target] scraperapi ' + res.status + ' for "' + query + '"')
  } catch (e) {
    console.warn('[target] scraperapi error for "' + query + '": ' + e.message)
  }

  return null
}

// ─── Map a RedSky product → our deal schema ──────────────────────────────────
function mapRedskyProduct(item, queryConfig) {
  const product = item?.item
  if (!product) return null

  const tcin  = product.tcin
  const title = product.product_description?.title?.trim()
  if (!tcin || !title) return null

  const priceData = item.price
  if (!priceData) return null

  const sale    = Number(priceData.current_retail) || Number(priceData.current_retail_min)
  const regular = Number(priceData.reg_retail) || Number(priceData.reg_retail_min) || sale
  if (!sale || sale < MIN_SALE_PRICE || sale > queryConfig.max) return null

  const discount_pct = regular > sale ? Math.round((1 - sale / regular) * 100) : 0
  if (discount_pct < MIN_DISCOUNT_PCT) return null

  const reviews = Number(item.ratings_and_reviews?.statistics?.rating?.count) || 0
  if (reviews < MIN_REVIEW_COUNT) return null

  const image = product.enrichment?.images?.primary_image_url
             || product.enrichment?.images?.image
  if (!image) return null

  const slug = product.enrichment?.buy_url
            || ('https://www.target.com/p/-/A-' + tcin)

  const catFromTitle = mapExternalCategory ? mapExternalCategory('', title) : categorize(title, '')
  const finalCategory = catFromTitle || queryConfig.category

  return {
    source_key:          'target',
    external_id:         'tgt-' + String(tcin),
    merchant:            'TARGET',
    source_type:         'api',
    title:               title.slice(0, 255),
    category:            finalCategory,
    sale_price:          sale,
    original_price:      regular > sale ? regular : null,
    discount_pct,
    product_url:         buildAffiliateUrl(slug),
    image_url:           image,
    currency:            'USD',
    in_stock:            true,
    is_student_relevant: queryConfig.student && (discount_pct >= 15 || sale < 50),
    is_featured:         false,
    fetched_at:          new Date().toISOString(),
    status:              'active',
  }
}

// Run one query end-to-end: RedSky fetch → map → filter
async function fetchTargetQuery(queryConfig) {
  const result = await fetchRedsky(queryConfig.q)
  if (!result) return { deals: [], credits: 0, raw: 0 }

  const products = result.data?.data?.search?.products
                || result.data?.search?.products
                || []

  if (!Array.isArray(products) || products.length === 0) {
    console.log('[target] "' + queryConfig.q + '": 0 raw products (' + result.strategy + ')')
    return { deals: [], credits: result.credits, raw: 0 }
  }

  const deals = products.map(p => mapRedskyProduct(p, queryConfig)).filter(Boolean)

  // Diagnostic: when filters reject every product, log shape of the first
  // raw row so we can see exactly what fields RedSky returned vs what the
  // mapper expected. Helps catch upstream schema changes early.
  if (deals.length === 0 && products[0]) {
    const sample = products[0]
    console.log('[target] DEBUG no-match for "' + queryConfig.q + '": ' + JSON.stringify({
      topKeys:       Object.keys(sample),
      hasItem:       !!sample.item,
      itemKeys:      sample.item ? Object.keys(sample.item).slice(0, 20) : null,
      tcin:          sample.tcin || sample.item?.tcin,
      title:         sample.item?.product_description?.title || sample.title || sample.item?.title,
      hasPrice:      !!sample.price,
      currentRetail: sample.price?.current_retail,
      regRetail:     sample.price?.reg_retail,
      reviewCount:   sample.ratings_and_reviews?.statistics?.rating?.count,
      enrichmentImg: !!sample.item?.enrichment?.images?.primary_image_url,
    }).slice(0, 1500))
  }

  console.log('[target] "' + queryConfig.q + '": ' + deals.length + ' deals from '
              + products.length + ' (' + result.strategy + ', ' + result.credits + 'cr)')
  return { deals, credits: result.credits, raw: products.length }
}

// ─── Public entry point ──────────────────────────────────────────────────────
export async function fetchTargetDeals() {
  const queries = isBackToSchoolSeason()
    ? [...QUERIES_BASE, ...QUERIES_SEASONAL]
    : QUERIES_BASE

  console.log('[target] Fetching ' + queries.length + ' queries serially '
              + '(seasonal=' + isBackToSchoolSeason() + ', delay=' + SERIAL_DELAY_MS + 'ms)')

  const all = []
  let totalCredits = 0
  let totalRaw     = 0

  for (let i = 0; i < queries.length; i++) {
    try {
      const r = await fetchTargetQuery(queries[i])
      all.push(...r.deals)
      totalCredits += r.credits
      totalRaw     += r.raw
    } catch (e) {
      // Per-query failure shouldn't kill the whole batch.
      console.error('[target] "' + queries[i].q + '" threw: ' + (e?.message || e))
    }
    // Sleep between queries to avoid bursts that trip RedSky's per-IP
    // rate limit. Skip the sleep after the last one — saves ~1s.
    if (i < queries.length - 1) await sleep(SERIAL_DELAY_MS)
  }

  // Dedupe by external_id (TCIN). Same product can appear in multiple
  // queries, e.g. a Chromebook surfaces in both "student laptop" and
  // "Chromebook" queries.
  const seen = new Set()
  const deduped = all.filter(d => {
    if (!d?.external_id || seen.has(d.external_id)) return false
    seen.add(d.external_id)
    return true
  })

  console.log('[target] TOTAL: ' + deduped.length + ' unique from ' + all.length
              + ' raw-mapped, ' + totalRaw + ' raw-products, ' + totalCredits + 'cr used')
  return deduped
}
