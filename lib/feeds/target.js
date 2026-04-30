// lib/feeds/target.js
//
// Pulls deals from Target via their internal RedSky aggregations API.
// RedSky is the same API that powers target.com search — undocumented but
// stable for years. No auth needed beyond a public web key (rotates rarely).
//
// Strategy:
//   1. Try direct fetch from Vercel first (free, 0 credits)
//   2. Fall back to ScraperAPI passthrough if direct is blocked (1 credit/req)
//   3. Premium proxy mode NOT used — protects the credit budget cap
//
// Budget: 20-25 queries × 1 cron/day × 30 days × ~1 credit = ~600/month
// expected. Free tier is 5,000/month; well under our 3,000-credit soft cap.

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

const FETCH_TIMEOUT_MS = 25000
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
async function fetchWithTimeout(url, opts = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, cache: 'no-store' })
  } finally {
    clearTimeout(t)
  }
}

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
    page:                         '/s/' + encodeURIComponent(query),
    platform:                     'desktop',
    pricing_store_id:             STORE_ID,
    spellcheck:                   'true',
    store_ids:                    STORE_ID,
    visitor_id:                   '0181E1A3F3000201A1AB2BC68DD75A92',
    pricing_story:                'sale',
  })
  return 'https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2?' + params.toString()
}

// ─── Multi-strategy fetch ─────────────────────────────────────────────────────
async function fetchRedsky(query) {
  const targetUrl = buildRedskyUrl(query)

  // Strategy 1: direct fetch (free)
  try {
    const res = await fetchWithTimeout(targetUrl, { headers: BROWSER_HEADERS })
    if (res.ok) {
      const data = await res.json()
      return { data, strategy: 'direct', credits: 0 }
    }
    if (res.status !== 403 && res.status !== 429 && res.status !== 503) {
      console.warn('[target] direct ' + res.status + ' for "' + query + '"')
      return null
    }
  } catch (e) {
    console.warn('[target] direct error for "' + query + '": ' + e.message)
  }

  // Strategy 2: ScraperAPI passthrough (1 credit)
  if (!SCRAPERAPI_KEY) {
    console.warn('[target] direct blocked, SCRAPERAPI_KEY not set')
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

async function fetchTargetQuery(queryConfig) {
  const result = await fetchRedsky(queryConfig.q)
  if (!result) return { deals: [], credits: 0 }

  const products = result.data?.data?.search?.products
                || result.data?.search?.products
                || []

  if (!Array.isArray(products) || products.length === 0) {
    console.log('[target] "' + queryConfig.q + '": 0 raw products (' + result.strategy + ')')
    return { deals: [], credits: result.credits }
  }

  const deals = products.map(p => mapRedskyProduct(p, queryConfig)).filter(Boolean)

  // DIAGNOSTIC: when parser maps zero deals, log shape of first product so we can
  // see exactly what fields RedSky is returning vs what our parser expects.
  if (deals.length === 0 && products[0]) {
    const sample = products[0]
    console.log('[target] DEBUG shape for "' + queryConfig.q + '": ' + JSON.stringify({
      topKeys:   Object.keys(sample),
      hasItem:   !!sample.item,
      itemKeys:  sample.item ? Object.keys(sample.item).slice(0, 20) : null,
      tcin:      sample.tcin || sample.item?.tcin,
      title:     sample.item?.product_description?.title || sample.title || sample.item?.title,
      hasPrice:  !!sample.price,
      priceKeys: sample.price ? Object.keys(sample.price) : null,
      currentRetail: sample.price?.current_retail,
      regRetail: sample.price?.reg_retail,
      reviewCount: sample.ratings_and_reviews?.statistics?.rating?.count,
      enrichmentImg: !!sample.item?.enrichment?.images?.primary_image_url,
    }).slice(0, 1500))
  }

  console.log('[target] "' + queryConfig.q + '": ' + deals.length + ' deals from ' + products.length + ' (' + result.strategy + ', ' + result.credits + 'cr)')
  return { deals, credits: result.credits }
}

// Serial dispatch: RedSky's anti-abuse fires when the same IP issues many
// concurrent searches in <1s. Memory of the 4/29 outage: first query
// succeeded, the next 14 in parallel got 429s, all fell through to
// ScraperAPI fallback → ScraperAPI's per-second concurrency cap also
// rejected the parallel burst → 0 deals. Sequential at 1.5s/call keeps
// us well under both rate limits.
//
// 15 queries × 1.5s = 22.5s wall clock. Plus ~0.5-1s per query for the
// HTTP round-trip = ~30-40s total, well within Vercel's 300s budget.
const RATE_LIMIT_DELAY_MS = 1500

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function runSerialWithDelay(items, fn, delayMs) {
  const out = []
  for (let i = 0; i < items.length; i++) {
    try {
      const v = await fn(items[i])
      out.push({ status: 'fulfilled', value: v })
    } catch (e) {
      out.push({ status: 'rejected', reason: e })
    }
    if (i < items.length - 1) await sleep(delayMs)
  }
  return out
}

export async function fetchTargetDeals() {
  const queries = isBackToSchoolSeason()
    ? [...QUERIES_BASE, ...QUERIES_SEASONAL]
    : QUERIES_BASE

  console.log('[target] Fetching ' + queries.length + ' queries serialized at '
              + RATE_LIMIT_DELAY_MS + 'ms apart (seasonal=' + isBackToSchoolSeason() + ')')

  const results = await runSerialWithDelay(queries, fetchTargetQuery, RATE_LIMIT_DELAY_MS)

  const all = []
  let totalCredits = 0
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      all.push(...r.value.deals)
      totalCredits += r.value.credits
    } else {
      console.error('[target] "' + queries[i].q + '" rejected: ' + r.reason?.message)
    }
  })

  const seen = new Set()
  const deduped = all.filter(d => {
    if (!d?.external_id || seen.has(d.external_id)) return false
    seen.add(d.external_id)
    return true
  })

  console.log('[target] TOTAL: ' + deduped.length + ' unique from ' + all.length + ' raw, ' + totalCredits + 'cr used')
  return deduped
}
