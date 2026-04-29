// lib/feeds/slickdeals.js
//
// Slickdeals is used as a DEAL DISCOVERY source only — we never expose any
// slickdeals.net URLs to users. The RSS no longer carries direct merchant
// URLs — every href in the description is wrapped as
// `slickdeals.net/click?lno=...&u3=<token>`. Two-step extraction:
//
//   1. ASIN-first (free, no HTTP) — if the item HTML carries `data-aps-asin`
//      or any embedded `/dp/{ASIN}` link, we build a clean amazon.com URL
//      and let buildAffiliateUrl() apply our associate tag. This handles the
//      Amazon majority instantly.
//
//   2. Click-resolver — for everything else, we follow the slickdeals.net/click
//      URL with redirect:'manual' and read the Location header to get the real
//      merchant URL. Resolutions are batched in groups of 8 with per-fetch
//      timeouts so a slow Slickdeals server can't blow the function budget.
//
// Items where neither path succeeds are dropped (no slickdeals.net URLs ever
// reach users). Woot deals are dropped entirely until the CJ Woot publisher
// relationship is reactivated — see the README in lib/utils/affiliateUrl.js.

import { categorize }                                          from '@/lib/utils/categorize'
import { buildAffiliateUrl, extractAsin, extractExitVendor }   from '@/lib/utils/affiliateUrl'

const FEEDS = [
  { url: 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1', label: 'slickdeals-frontpage' },
  { url: 'https://slickdeals.net/newsearch.php?mode=popdeals&searcharea=deals&searchin=first&rss=1',  label: 'slickdeals-popular'   },
  { url: 'https://slickdeals.net/newsearch.php?mode=topdeals&searcharea=deals&searchin=first&rss=1',  label: 'slickdeals-top'       },
]

// Resolver tuning. 8-wide concurrency × 4s per request = 4s per batch worst-case.
// At 50 items/feed × 3 feeds with ~30% caught by ASIN, ~100 items need resolution
// → ~13 batches × 4s = ~52s worst-case, but typical responses are much faster
// (Slickdeals click handler usually responds in 100-500ms). 60s function budget.
const RESOLVE_BATCH_SIZE   = 8
const RESOLVE_TIMEOUT_MS   = 4000
const MAX_REDIRECT_HOPS    = 4
const BATCH_JITTER_MIN_MS  = 50
const BATCH_JITTER_MAX_MS  = 150

// Merchants we explicitly refuse to surface, regardless of feed:
//   - woot.com: CJ Woot publisher relationship inactive — wrapped links 404
//     until BPMAKER re-applies via members.cj.com joinprograms.do.
const SKIP_MERCHANTS = new Set(['woot.com'])

// Anything still hosted on a deals aggregator after resolution = give up.
// (Should be rare — slickdeals click handler nearly always lands on a real
// merchant — but defensive.)
const AGGREGATOR_DOMAINS = new Set([
  'slickdeals.net', 'edealinfo.com', 'dealnews.com',
  'dealsea.com',    'dealsplus.com',  'bfads.net',     'gottadeal.com',
])

function isHostMatch(url, set) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    for (const domain of set) {
      if (host === domain || host.endsWith('.' + domain)) return true
    }
    return false
  } catch { return false }
}

function isAggregatorUrl(url) { return isHostMatch(url, AGGREGATOR_DOMAINS) }
function isSkippedMerchant(url) { return isHostMatch(url, SKIP_MERCHANTS) }

// Friendly merchant display name from a resolved URL host
function merchantName(url = '') {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const map = {
      'amazon.com':       'AMAZON',
      'amzn.to':          'AMAZON',
      'walmart.com':      'WALMART',
      'woot.com':         'WOOT',
      'bestbuy.com':      'BEST BUY',
      'target.com':       'TARGET',
      'ebay.com':         'EBAY',
      'homedepot.com':    'HOME DEPOT',
      'lowes.com':        "LOWE'S",
      'newegg.com':       'NEWEGG',
      'costco.com':       'COSTCO',
      'adorama.com':      'ADORAMA',
      'bhphotovideo.com': 'B&H',
      'macys.com':        "MACY'S",
      'adidas.com':       'ADIDAS',
      'nike.com':         'NIKE',
      'samsclub.com':     "SAM'S CLUB",
      'kohls.com':        "KOHL'S",
      'staples.com':      'STAPLES',
      'officedepot.com':  'OFFICE DEPOT',
      'lenovo.com':       'LENOVO',
      'dell.com':         'DELL',
      'hp.com':           'HP',
      'apple.com':        'APPLE',
      'samsung.com':      'SAMSUNG',
      'gamestop.com':     'GAMESTOP',
      'antonline.com':    'ANTONLINE',
      'rei.com':          'REI',
    }
    for (const [domain, name] of Object.entries(map)) {
      if (host === domain || host.endsWith('.' + domain)) return name
    }
    return host.split('.')[0].toUpperCase()
  } catch { return 'STORE' }
}

// ── Step 1: ASIN extraction (free, no HTTP) ──────────────────────────────────
// Reuses extractAsin from affiliateUrl.js which checks both `data-aps-asin="..."`
// and `/dp/ASIN` patterns.

// ── Step 2: click-URL resolution ─────────────────────────────────────────────

// Pull the slickdeals.net/click URL out of the item HTML. Slickdeals sometimes
// repeats the same href twice (one for the merchant name, one for the bracketed
// domain link); we only need the first.
function extractClickUrl(html = '') {
  if (!html) return null
  const m = html.match(/href=["'](https?:\/\/slickdeals\.net\/click\?[^"']+)["']/i)
  if (!m) return null
  // RSS XML entity-encodes & inside attribute values; un-decode for the fetch
  return m[1].replace(/&amp;/g, '&').replace(/&#38;/g, '&')
}

// Follow the slickdeals click URL, return the final merchant URL or null.
// Uses redirect:'manual' so we can inspect each Location ourselves and stop
// chasing if it loops or lands on an unsupported merchant.
async function resolveClickUrl(clickUrl, hops = 0) {
  if (hops > MAX_REDIRECT_HOPS) return null
  const controller = new AbortController()
  const timeout    = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS)
  try {
    const res = await fetch(clickUrl, {
      method:   'GET',
      redirect: 'manual',
      signal:   controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':     '*/*',
      },
    })
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return null
      // Chained slickdeals redirect (rare) — keep following
      if (/slickdeals\.net/i.test(location)) return resolveClickUrl(location, hops + 1)
      return location
    }
    // 200 or other — slickdeals served the page itself; can't extract
    return null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// ── RSS parsing helpers (unchanged from prior version) ───────────────────────

function extractPrices(text = '') {
  return [...text.matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g)]
    .map(m => parseFloat(m[1].replace(/,/g, '')))
    .filter(p => p > 0 && p < 10000)
    .sort((a, b) => b - a)
}

function stripHtml(html = '') {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractCDATA(tag, xml) {
  const re = new RegExp('<' + tag + '[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/' + tag + '>|<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i')
  const m = xml.match(re)
  return m ? (m[1] || m[2] || '').trim() : ''
}

function extractImage(html = '') {
  const m = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
  return m ? m[1] : null
}

function cleanTitle(title = '') {
  return title
    .replace(/^\$[\d,]+\.?\d*\s*\|\s*/, '')
    .replace(/\s+at\s+\w[\w\s&']*\!?\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 255)
}

// ── Per-item parser ─────────────────────────────────────────────────────────

async function parseItem(itemXml, feedLabel) {
  const title   = extractCDATA('title', itemXml)
  const desc    = extractCDATA('description', itemXml)
  const encoded = extractCDATA('content:encoded', itemXml)
  const guid    = extractCDATA('guid', itemXml)
  const linkM   = itemXml.match(/<link>([^<]+)<\/link>/)
  const sdLink  = linkM ? linkM[1].trim() : ''
  if (!title) return null

  const html = encoded || desc

  // Step 1: ASIN-first. If we find one, we never need to call slickdeals.
  const asin = extractAsin(html)
  let merchantUrl = null

  if (asin) {
    merchantUrl = 'https://www.amazon.com/dp/' + asin
  } else {
    // Step 2: Pre-filter via the exit-website hint baked into the anchor.
    // No HTTP yet — just a regex match on data-product-exitWebsite.
    const exitVendor = extractExitVendor(html)
    if (exitVendor && SKIP_MERCHANTS.has(exitVendor)) return null

    // Step 3: Resolve the slickdeals.net/click URL.
    const clickUrl = extractClickUrl(html)
    if (!clickUrl) return null
    const resolved = await resolveClickUrl(clickUrl)
    if (!resolved) return null
    if (isAggregatorUrl(resolved))   return null   // landed on another aggregator
    if (isSkippedMerchant(resolved)) return null   // woot, etc.
    merchantUrl = resolved
  }

  // buildAffiliateUrl handles: tag injection for Amazon/Walmart, CJ wrap for
  // Woot (we already filtered Woot above), tracking-param strip for everyone
  // else. Idempotent for already-wrapped Amazon/Walmart URLs.
  const product_url = buildAffiliateUrl(merchantUrl, asin)
  if (!product_url) return null

  const descText     = stripHtml(html)
  const combinedText = title + ' ' + descText
  const prices       = extractPrices(combinedText)
  if (prices.length === 0) return null

  const sale_price     = Math.min(...prices)
  const original_price = prices.length > 1 && Math.max(...prices) > sale_price * 1.05 ? Math.max(...prices) : null
  const discount_pct   = original_price ? Math.round((1 - sale_price / original_price) * 100) : 0

  const image    = extractImage(html)
  const merchant = merchantName(merchantUrl)
  const category = categorize(title, descText)

  return {
    source_key:          feedLabel,
    external_id:         guid || sdLink || merchantUrl,  // never user-facing
    merchant,
    source_type:         'rss',
    title:               cleanTitle(title),
    category,
    sale_price,
    original_price,
    discount_pct,
    product_url,
    image_url:           image || null,
    currency:            'USD',
    in_stock:            true,
    is_student_relevant: ['Electronics', 'Computers', 'Phones', 'Accessories'].includes(category) && (discount_pct >= 15 || sale_price < 100),
    is_featured:         false,
    fetched_at:          new Date().toISOString(),
    status:              'active',
  }
}

// ── Per-feed parser with parallel batched resolution ─────────────────────────

async function parseFeed(xml, feedLabel) {
  const itemRe   = /<item>([\s\S]*?)<\/item>/gi
  const itemXmls = []
  let m
  while ((m = itemRe.exec(xml)) !== null) itemXmls.push(m[1])

  const results = []
  let dropped   = 0

  // Batch resolutions to bound concurrency. Small jitter between batches keeps
  // us a bit more polite to Slickdeals's click endpoint.
  for (let i = 0; i < itemXmls.length; i += RESOLVE_BATCH_SIZE) {
    const batch        = itemXmls.slice(i, i + RESOLVE_BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(itemXml => parseItem(itemXml, feedLabel).catch(e => {
        console.warn('[slickdeals] parse error:', e.message)
        return null
      })),
    )
    for (const r of batchResults) {
      if (r) results.push(r); else dropped++
    }
    if (i + RESOLVE_BATCH_SIZE < itemXmls.length) {
      const jitter = BATCH_JITTER_MIN_MS + Math.random() * (BATCH_JITTER_MAX_MS - BATCH_JITTER_MIN_MS)
      await new Promise(r => setTimeout(r, jitter))
    }
  }

  if (dropped > 0) {
    console.log('[slickdeals] ' + feedLabel + ': kept ' + results.length + ', dropped ' + dropped + ' of ' + itemXmls.length)
  }
  return results
}

export async function fetchSlickdealsDeals() {
  console.log('[slickdeals] Fetching ' + FEEDS.length + ' feeds')
  const results = await Promise.allSettled(
    FEEDS.map(async ({ url, label }) => {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept':     'application/rss+xml, application/xml, text/xml, */*',
        },
        next: { revalidate: 0 },
      })
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + label)
      const xml   = await res.text()
      const deals = await parseFeed(xml, label)
      console.log('[slickdeals] ' + label + ': ' + deals.length + ' deals with merchant URLs')
      return deals
    }),
  )

  for (const r of results) {
    if (r.status === 'rejected') console.warn('[slickdeals] feed error:', r.reason?.message || r.reason)
  }

  const all  = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value)
  const seen = new Set()
  return all.filter(d => {
    if (seen.has(d.external_id)) return false
    seen.add(d.external_id)
    return true
  })
}
