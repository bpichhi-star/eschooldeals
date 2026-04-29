// lib/feeds/slickdeals.js
//
// Slickdeals is used as a DEAL DISCOVERY source only — we never expose any
// slickdeals.net URLs to users. For every RSS item we extract the real
// merchant URL out of the description HTML, strip any tracking params, and
// rewrap with our own affiliate ID via buildAffiliateUrl().
//
// If we can't find a merchant URL for an item, the item is dropped entirely
// (no fake search-page fallback).

import { categorize }                    from '@/lib/utils/categorize'
import { buildAffiliateUrl, extractAsin } from '@/lib/utils/affiliateUrl'

const FEEDS = [
  { url: 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1', label: 'slickdeals-frontpage' },
  { url: 'https://slickdeals.net/newsearch.php?mode=popdeals&searcharea=deals&searchin=first&rss=1',  label: 'slickdeals-popular'   },
  { url: 'https://slickdeals.net/newsearch.php?mode=topdeals&searcharea=deals&searchin=first&rss=1',  label: 'slickdeals-top'       },
]

// Domains we never want to surface as the merchant — aggregators, the Slickdeals
// click-tracker itself, and CJ/Rakuten redirect domains (we want the FINAL
// merchant URL so we can rewrap with our own affiliate, not someone else's).
const AGGREGATOR_DOMAINS = new Set([
  'slickdeals.net', 'edealinfo.com', 'dealnews.com',
  'dealsea.com',    'dealsplus.com',  'bfads.net',     'gottadeal.com',
  // Affiliate redirect networks — we never want their wrapped URLs surfacing
  'anrdoezrs.net', 'dpbolvw.net',   'jdoqocy.com',   'kqzyfj.com', 'tkqlhce.com',
  'rover.ebay.com', 'shopstyle.it', 'go.skimresources.com',
])

function isAggregatorUrl(url = '') {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return AGGREGATOR_DOMAINS.has(host)
  } catch { return false }
}

// Asset / pixel / tracking URLs we should never treat as the merchant link
const ASSET_RE = /\.(jpg|jpeg|png|gif|webp|svg|css|js)(\?|$)|pixel|beacon|track|click\.php/i

// Pull the first real merchant href out of an HTML chunk. We prefer hrefs
// that carry data-cta="outclick" (Slickdeals's own marker for the merchant
// link) when present, otherwise fall back to the first non-aggregator http link.
function extractMerchantUrl(html = '') {
  if (!html) return null

  // Prefer outclick-tagged hrefs when Slickdeals provides them
  const outclickRe = /(?:data-cta=["']outclick["'][^>]*?href=["']([^"']+)["'])|(?:href=["']([^"']+)["'][^>]*?data-cta=["']outclick["'])/gi
  let m
  while ((m = outclickRe.exec(html)) !== null) {
    const href = m[1] || m[2]
    if (href && !isAggregatorUrl(href) && !ASSET_RE.test(href) && href.startsWith('http')) {
      return href
    }
  }

  // Fallback — first non-aggregator http href
  const hrefRe = /href=["']([^"']+)["']/gi
  while ((m = hrefRe.exec(html)) !== null) {
    const href = m[1]
    if (!href.startsWith('http')) continue
    if (isAggregatorUrl(href))   continue
    if (ASSET_RE.test(href))     continue
    return href
  }

  return null
}

// Friendly merchant display name from URL host
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
    // Match base domain or any subdomain of a known host
    for (const [domain, name] of Object.entries(map)) {
      if (host === domain || host.endsWith('.' + domain)) return name
    }
    return host.split('.')[0].toUpperCase()
  } catch { return 'STORE' }
}

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

// Strip Slickdeals-specific prefixes/suffixes that pollute deal titles
function cleanTitle(title = '') {
  return title
    .replace(/^\$[\d,]+\.?\d*\s*\|\s*/, '')   // "$19.99 | …"  → "…"
    .replace(/\s+at\s+\w[\w\s&']*\!?\s*$/i, '')// "… at Woot!"  → "…"
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 255)
}

function parseItem(itemXml, feedLabel) {
  const title   = extractCDATA('title', itemXml)
  const desc    = extractCDATA('description', itemXml)
  const encoded = extractCDATA('content:encoded', itemXml)
  const guid    = extractCDATA('guid', itemXml)
  const linkM   = itemXml.match(/<link>([^<]+)<\/link>/)
  const sdLink  = linkM ? linkM[1].trim() : ''
  if (!title) return null

  // Find a real merchant URL — try content:encoded first (richer HTML), then description
  const rawMerchantUrl = extractMerchantUrl(encoded) || extractMerchantUrl(desc)
  if (!rawMerchantUrl) return null   // No merchant URL → drop this deal

  const asin        = extractAsin(encoded || desc)
  const product_url = buildAffiliateUrl(rawMerchantUrl, asin)
  if (!product_url) return null

  const descText     = stripHtml(encoded || desc)
  const combinedText = title + ' ' + descText
  const prices       = extractPrices(combinedText)
  if (prices.length === 0) return null

  const sale_price     = Math.min(...prices)
  const original_price = prices.length > 1 && Math.max(...prices) > sale_price * 1.05 ? Math.max(...prices) : null
  const discount_pct   = original_price ? Math.round((1 - sale_price / original_price) * 100) : 0

  const image    = extractImage(encoded || desc)
  const merchant = merchantName(rawMerchantUrl)
  const category = categorize(title, descText)

  return {
    source_key:          feedLabel,
    // external_id is internal-only; not surfaced to users. Use guid (slickdeals-internal)
    // for de-dup but never expose this anywhere user-facing.
    external_id:         guid || sdLink || rawMerchantUrl,
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
    is_student_relevant: ['Electronics', 'Computers', 'Phones'].includes(category) && (discount_pct >= 15 || sale_price < 100),
    is_featured:         false,
    fetched_at:          new Date().toISOString(),
    status:              'active',
  }
}

function parseFeed(xml, feedLabel) {
  const items  = []
  const itemRe = /<item>([\s\S]*?)<\/item>/gi
  let dropped = 0
  let m
  while ((m = itemRe.exec(xml)) !== null) {
    try {
      const d = parseItem(m[1], feedLabel)
      if (d) items.push(d)
      else dropped++
    } catch (e) {
      console.warn('[slickdeals] parse error:', e.message)
      dropped++
    }
  }
  if (dropped > 0) console.log('[slickdeals] ' + feedLabel + ': dropped ' + dropped + ' items (no merchant URL or invalid price)')
  return items
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
      const deals = parseFeed(xml, label)
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
