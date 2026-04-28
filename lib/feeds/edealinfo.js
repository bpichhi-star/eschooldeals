// lib/feeds/edealinfo.js
//
// FETCH STRATEGY (in order, first non-empty wins):
//   1. Direct server-side fetch with full browser headers
//   2. corsproxy.io (fresh, not in the original blocked-three)
//   3. Google Cache snapshot (last-resort historical pull)
//
// The original implementation chained THREE blocked proxies (rss2json,
// allorigins, cors.sh) and never tried the host directly. Cloudflare
// fingerprints those proxy IPs, so 100% of attempts failed and 0 eDealInfo
// deals ever reached the DB. CORS proxies are also pointless for server-side
// code — CORS is a browser concept, not a network restriction.
//
// Each path logs its exact outcome (status, body length, item count) so the
// next failure mode is debuggable from Vercel logs without redeploying.

import { categorize, mapExternalCategory } from '@/lib/utils/categorize'
import { buildAffiliateUrl } from '@/lib/utils/affiliateUrl'

// ─── Feeds ────────────────────────────────────────────────────────────────────
const FEEDS = [
  { url: 'https://www.edealinfo.com/deals-rss.php',             label: 'edealinfo-all' },
  { url: 'https://www.edealinfo.com/deals-rss.php?s=top',       label: 'edealinfo-top' },
  { url: 'https://www.edealinfo.com/deals-rss.php?cat=comp',    label: 'edealinfo-tech' },
  { url: 'https://www.edealinfo.com/deals-rss.php?cat=nontech', label: 'edealinfo-nontech' },
]

// ─── Browser headers — mimic a real Chrome request ─────────────────────────────
// Cloudflare scores requests on header completeness. This set passes the basic
// checks; if Cloudflare escalates to JS challenge we'd need a headless browser.
const BROWSER_HEADERS = {
  'User-Agent':                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language':           'en-US,en;q=0.9',
  'Accept-Encoding':           'gzip, deflate, br',
  'Cache-Control':             'no-cache',
  'Pragma':                    'no-cache',
  'Sec-Ch-Ua':                 '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'Sec-Ch-Ua-Mobile':          '?0',
  'Sec-Ch-Ua-Platform':        '"Windows"',
  'Sec-Fetch-Dest':            'document',
  'Sec-Fetch-Mode':            'navigate',
  'Sec-Fetch-Site':            'none',
  'Sec-Fetch-User':            '?1',
  'Upgrade-Insecure-Requests': '1',
  'Referer':                   'https://www.google.com/',
}

const FETCH_TIMEOUT_MS = 15000

// ─── URL resolution helpers ────────────────────────────────────────────────────
const OTHER_AGGREGATORS = new Set(['slickdeals.net', 'dealnews.com', 'dealsea.com', 'dealsplus.com'])
function isOtherAggregator(url = '') {
  try { return OTHER_AGGREGATORS.has(new URL(url).hostname.replace('www.', '')) }
  catch { return false }
}

function unwrapEdiUrl(href = '') {
  if (!href.includes('edealinfo.com')) return href
  try {
    const u = new URL(href)
    for (const p of ['u', 'url', 'dest', 'destination', 'target', 'link', 'goto', 'out', 'to']) {
      const val = u.searchParams.get(p)
      if (val) {
        const d = decodeURIComponent(val)
        if (d.startsWith('http')) return d
      }
    }
  } catch {}
  return null
}

function extractMerchantUrl(html = '') {
  const decoded = html.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  const hrefRe = /href=["']([^"']+)["']/gi
  let m
  while ((m = hrefRe.exec(decoded)) !== null) {
    let href = m[1].trim()
    if (!href.startsWith('http')) continue
    if (/\.(jpg|jpeg|png|gif|webp|svg)|pixel|beacon/i.test(href)) continue
    if (href.includes('edealinfo.com')) {
      href = unwrapEdiUrl(href)
      if (!href) continue
    }
    if (isOtherAggregator(href)) continue
    return href
  }
  return null
}

function extractAsin(t = '') {
  const m = t.match(/amazon\.com\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)
  return m?.[1] || null
}

function merchantName(url = '') {
  try {
    const h = new URL(url).hostname.replace('www.', '')
    const map = {
      'amazon.com': 'AMAZON', 'walmart.com': 'WALMART', 'woot.com': 'WOOT',
      'bestbuy.com': 'BEST BUY', 'target.com': 'TARGET', 'ebay.com': 'EBAY',
      'homedepot.com': 'HOME DEPOT', 'newegg.com': 'NEWEGG', 'costco.com': 'COSTCO',
      'dell.com': 'DELL', 'lenovo.com': 'LENOVO', 'apple.com': 'APPLE',
    }
    return map[h] || h.split('.')[0].toUpperCase()
  } catch { return 'STORE' }
}

function parseSalePrice(t = '') {
  const a = t.match(/only\s+\$\s*([\d,]+\.?\d*)/i)
  if (a) return parseFloat(a[1].replace(/,/g, ''))
  const b = t.match(/\$\s*([\d,]+\.?\d*)/)
  return b ? parseFloat(b[1].replace(/,/g, '')) : null
}

function parseOriginalPrice(d = '') {
  const m = d.match(/Compare.*?\(\$\s*([\d,]+\.?\d*)\)/i)
       || d.match(/(?:was|reg|list)\s*:?\s*\$\s*([\d,]+\.?\d*)/i)
  return m ? parseFloat(m[1].replace(/,/g, '')) : null
}

function computeDiscount(sale, original) {
  if (!original || !sale || original <= sale) return 0
  return Math.round((1 - sale / original) * 100)
}

// ─── XML parser ───────────────────────────────────────────────────────────────
function parseXmlItems(xml, feedLabel) {
  const items = []
  const itemRe = /<item>([\s\S]*?)<\/item>/gi
  let m
  while ((m = itemRe.exec(xml)) !== null) {
    try {
      const itemXml = m[1]
      const getC = (tag) => {
        const r = new RegExp(
          '<' + tag + '[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></' + tag + '>'
          + '|<' + tag + '[^>]*>([^<]*)</' + tag + '>',
          'i'
        )
        const x = itemXml.match(r)
        return x ? (x[1] || x[2] || '').trim() : ''
      }
      const title = getC('title')
      const link  = (itemXml.match(/<link>([^<]+)<\/link>/) || [])[1]?.trim() || ''
      const desc  = getC('description')
      const guid  = getC('guid')
      if (!title) continue

      const sale_price = parseSalePrice(title)
      if (!sale_price) continue

      const descText        = desc.replace(/<[^>]+>/g, ' ').trim()
      const original_price  = parseOriginalPrice(descText) || null
      const discount_pct    = computeDiscount(sale_price, original_price)
      const imgM            = desc.match(/<img[^>]+src=["']([^"']+)["']/i)
      const image           = imgM ? imgM[1] : null
      const asin            = extractAsin(desc + ' ' + link)
      const rawUrl = asin
        ? 'https://www.amazon.com/dp/' + asin
        : extractMerchantUrl(desc) || unwrapEdiUrl(link)
      if (!rawUrl || rawUrl.includes('edealinfo.com')) continue

      const mappedCategory = mapExternalCategory
        ? mapExternalCategory('', title)
        : categorize(title, descText)

      items.push({
        source_key:          feedLabel,
        external_id:         guid || link,
        merchant:            asin ? 'AMAZON' : merchantName(rawUrl),
        source_type:         'rss',
        title:               title.replace(/\s+only\s+\$[\d.,]+\s*$/i, '').trim().slice(0, 255),
        category:            mappedCategory,
        sale_price,
        original_price,
        discount_pct,
        product_url:         buildAffiliateUrl(rawUrl, asin || null),
        image_url:           image,
        currency:            'USD',
        in_stock:            true,
        is_student_relevant: discount_pct >= 20 && ['Electronics', 'Computers', 'Phones'].includes(mappedCategory),
        is_featured:         false,
        score:               Math.min(discount_pct, 50) + (image ? 10 : 0) + (desc.includes('Super Hot') ? 8 : 0),
        fetched_at:          new Date().toISOString(),
        status:              'active',
      })
    } catch (e) {
      console.warn('[edealinfo] xml parse err:', e.message)
    }
  }
  return items
}

// ─── Fetch with timeout ───────────────────────────────────────────────────────
async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, cache: 'no-store' })
  } finally {
    clearTimeout(t)
  }
}

// ─── Body validators ──────────────────────────────────────────────────────────
function looksLikeRss(body = '') {
  return body.includes('<item>') && (body.includes('<rss') || body.includes('<?xml'))
}

function looksLikeCloudflareChallenge(body = '') {
  return /(just a moment|cf-browser-verification|cf-chl-bypass|attention required|cloudflare)/i.test(body.slice(0, 2000))
}

// ─── Strategy 1: Direct fetch ──────────────────────────────────────────────────
async function tryDirect(feedUrl, label) {
  try {
    const res = await fetchWithTimeout(feedUrl, { headers: BROWSER_HEADERS })
    const body = await res.text()
    if (!res.ok) {
      console.warn('[edealinfo] direct ' + label + ' HTTP ' + res.status + ' (body ' + body.length + 'b)')
      return null
    }
    if (looksLikeCloudflareChallenge(body)) {
      console.warn('[edealinfo] direct ' + label + ' got Cloudflare challenge — falling back')
      return null
    }
    if (!looksLikeRss(body)) {
      console.warn('[edealinfo] direct ' + label + ' non-RSS response (' + body.length + 'b, starts: ' + body.slice(0, 80).replace(/\s+/g, ' ') + ')')
      return null
    }
    const items = parseXmlItems(body, label)
    console.log('[edealinfo] direct ' + label + ' SUCCESS: ' + items.length + ' deals (' + body.length + 'b)')
    return items
  } catch (e) {
    console.warn('[edealinfo] direct ' + label + ' error: ' + e.message)
    return null
  }
}

// ─── Strategy 2: corsproxy.io (fresh, not in original blocked-three) ───────────
async function tryCorsProxy(feedUrl, label) {
  const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(feedUrl)
  try {
    const res = await fetchWithTimeout(proxyUrl, {
      headers: { 'User-Agent': BROWSER_HEADERS['User-Agent'] }
    })
    const body = await res.text()
    if (!res.ok || !looksLikeRss(body)) {
      console.warn('[edealinfo] corsproxy ' + label + ' HTTP ' + res.status + ' rss=' + looksLikeRss(body))
      return null
    }
    const items = parseXmlItems(body, label)
    console.log('[edealinfo] corsproxy ' + label + ' SUCCESS: ' + items.length + ' deals')
    return items
  } catch (e) {
    console.warn('[edealinfo] corsproxy ' + label + ' error: ' + e.message)
    return null
  }
}

// ─── Strategy 3: Google Cache (historical fallback) ────────────────────────────
async function tryGoogleCache(feedUrl, label) {
  const cacheUrl = 'https://webcache.googleusercontent.com/search?q=cache:' + encodeURIComponent(feedUrl)
  try {
    const res = await fetchWithTimeout(cacheUrl, { headers: BROWSER_HEADERS })
    const body = await res.text()
    if (!res.ok || !looksLikeRss(body)) {
      console.warn('[edealinfo] gcache ' + label + ' HTTP ' + res.status + ' rss=' + looksLikeRss(body))
      return null
    }
    const items = parseXmlItems(body, label)
    console.log('[edealinfo] gcache ' + label + ' SUCCESS (stale): ' + items.length + ' deals')
    return items
  } catch (e) {
    console.warn('[edealinfo] gcache ' + label + ' error: ' + e.message)
    return null
  }
}

// ─── Strategy chain ────────────────────────────────────────────────────────────
async function fetchOneFeed(feedUrl, label) {
  const direct = await tryDirect(feedUrl, label)
  if (direct && direct.length) return direct

  const proxy = await tryCorsProxy(feedUrl, label)
  if (proxy && proxy.length) return proxy

  const cache = await tryGoogleCache(feedUrl, label)
  if (cache && cache.length) return cache

  console.error('[edealinfo] ALL STRATEGIES FAILED for ' + label)
  return []
}

// ─── Public entry point ────────────────────────────────────────────────────────
export async function fetchEDealInfoDeals() {
  console.log('[edealinfo] Fetching ' + FEEDS.length + ' feeds — strategy: direct → corsproxy → gcache')

  const results = await Promise.allSettled(FEEDS.map(f => fetchOneFeed(f.url, f.label)))
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error('[edealinfo] ' + FEEDS[i].label + ' rejected: ' + r.reason?.message)
    }
  })

  const all  = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value)
  const seen = new Set()
  const deduped = all.filter(d => {
    const k = d.external_id || d.title?.slice(0, 60)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  console.log('[edealinfo] TOTAL: ' + deduped.length + ' unique deals from ' + all.length + ' raw')
  return deduped
}
