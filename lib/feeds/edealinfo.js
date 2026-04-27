// lib/feeds/edealinfo.js
import { categorize, mapExternalCategory } from '@/lib/utils/categorize'
import { buildAffiliateUrl } from '@/lib/utils/affiliateUrl'

const FEEDS = [
  { url: 'https://www.edealinfo.com/deals-rss.php',             label: 'edealinfo-all' },
  { url: 'https://www.edealinfo.com/deals-rss.php?s=top',       label: 'edealinfo-top' },
  { url: 'https://www.edealinfo.com/deals-rss.php?cat=comp',    label: 'edealinfo-tech' },
  { url: 'https://www.edealinfo.com/deals-rss.php?cat=nontech', label: 'edealinfo-nontech' },
]

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.google.com/',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-CH-UA': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'Sec-CH-UA-Mobile': '?0',
  'Sec-CH-UA-Platform': '"Windows"',
}

// Other aggregator domains we never surface (NOT edealinfo — we unwrap their redirects instead)
const OTHER_AGGREGATORS = new Set([
  'slickdeals.net', 'dealnews.com', 'dealsea.com',
  'dealsplus.com', 'bfads.net', 'gottadeal.com',
])

function isOtherAggregator(url = '') {
  try {
    const host = new URL(url).hostname.replace('www.', '')
    return OTHER_AGGREGATORS.has(host)
  } catch { return false }
}

/**
 * eDealInfo wraps outbound links as redirects, e.g.:
 *   https://www.edealinfo.com/go.php?id=12345&url=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0ABC
 *   https://www.edealinfo.com/rd.php?url=https%3A%2F%2Fwww.bestbuy.com%2F...
 *   https://www.edealinfo.com/click.php?u=https%3A%2F%2F...
 * We extract the destination from query params first.
 * If no redirect param found and it's a direct edealinfo URL, skip it.
 */
function unwrapEdiUrl(href = '') {
  if (!href.includes('edealinfo.com')) return href
  try {
    const u = new URL(href)
    // Common redirect param names
    for (const param of ['url', 'u', 'dest', 'destination', 'target', 'link', 'goto', 'out']) {
      const val = u.searchParams.get(param)
      if (val && val.startsWith('http')) return decodeURIComponent(val)
    }
    // Try to decode the entire path if it looks like a base64 or encoded URL
    const raw = u.searchParams.get('id') || u.searchParams.get('ref')
    if (raw) return null  // just an ID param, no URL to extract
  } catch {}
  return null  // edealinfo URL with no extractable destination — discard
}

// Pull the first real merchant href from description HTML
function extractMerchantUrl(html = '') {
  const hrefRe = /href=["']([^"']+)["']/gi
  let m
  while ((m = hrefRe.exec(html)) !== null) {
    let href = m[1]
    if (!href.startsWith('http')) continue
    if (/\.(jpg|jpeg|png|gif|webp|svg|css|js)|pixel|beacon/i.test(href)) continue

    // Unwrap eDealInfo redirects
    if (href.includes('edealinfo.com')) {
      href = unwrapEdiUrl(href)
      if (!href) continue
    }

    if (isOtherAggregator(href)) continue
    return href
  }
  return null
}

// ASIN from anywhere in the description
function extractAsin(html = '') {
  const m = html.match(/(?:amazon\.com\/(?:dp|gp\/product|exec\/obidos\/ASIN)\/|asin=)([A-Z0-9]{10})/i)
  return m ? m[1] : null
}

function merchantName(url = '') {
  try {
    const host = new URL(url).hostname.replace('www.', '')
    const map = {
      'amazon.com': 'AMAZON', 'amzn.to': 'AMAZON',
      'walmart.com': 'WALMART', 'woot.com': 'WOOT',
      'bestbuy.com': 'BEST BUY', 'target.com': 'TARGET',
      'ebay.com': 'EBAY', 'homedepot.com': 'HOME DEPOT',
      'lowes.com': "LOWE'S", 'newegg.com': 'NEWEGG',
      'costco.com': 'COSTCO', 'adorama.com': 'ADORAMA',
      'bhphotovideo.com': 'B&H', 'macys.com': "MACY'S",
      'adidas.com': 'ADIDAS', 'nike.com': 'NIKE',
      'samsclub.com': "SAM'S CLUB", 'kohls.com': "KOHL'S",
      'staples.com': 'STAPLES', 'officedepot.com': 'OFFICE DEPOT',
      'lenovo.com': 'LENOVO', 'dell.com': 'DELL', 'hp.com': 'HP',
      'apple.com': 'APPLE', 'samsung.com': 'SAMSUNG',
      'gamestop.com': 'GAMESTOP',
    }
    return map[host] || host.split('.')[0].toUpperCase()
  } catch { return 'STORE' }
}

function get(xml, tag) {
  const re = new RegExp('<' + tag + '[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/' + tag + '>|<' + tag + '[^>]*>([^<]*)<\/' + tag + '>', 'i')
  const m = xml.match(re)
  return m ? (m[1] || m[2] || '').trim() : ''
}

function stripHtml(html = '') { return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }

function extractImage(html = '') {
  const amzM = html.match(/src=['"]([^'"]+m\.media-amazon\.com[^'"]+)['"]/)
  if (amzM) return amzM[1].replace(/_AA200_/, '_SL500_')
  const ebayM = html.match(/src=['"]([^'"]+ebayimg\.com[^'"]+)['"]/)
  if (ebayM) return ebayM[1]
  const anyM = html.match(/<img[^>]+src=['"]([^'"]+)['"]/)
  return anyM ? anyM[1] : null
}

function parseSalePrice(title = '') {
  const onlyM = title.match(/only\s+\$\s*([\d,]+\.?\d*)/i)
  if (onlyM) return parseFloat(onlyM[1].replace(/,/g, ''))
  const rangeM = title.match(/\$\s*([\d,]+\.?\d*)\s*[-\u2013]\s*\$\s*([\d,]+\.?\d*)/)
  if (rangeM) return parseFloat(rangeM[1].replace(/,/g, ''))
  const m = title.match(/\$\s*([\d,]+\.?\d*)/)
  return m ? parseFloat(m[1].replace(/,/g, '')) : null
}

function parseOriginalPrice(description = '') {
  const compareRe = /Compare.*?\(\$\s*([\d,]+\.?\d*)\)/gi
  let highest = null, m
  while ((m = compareRe.exec(description)) !== null) {
    const p = parseFloat(m[1].replace(/,/g, ''))
    if (!highest || p > highest) highest = p
  }
  return highest
}

function computeDiscount(sale, original) {
  if (!original || !sale || original <= sale) return 0
  return Math.round((1 - sale / original) * 100)
}

function parseItem(itemXml, feedLabel) {
  const title       = get(itemXml, 'title')
  const description = get(itemXml, 'description')
  const category    = get(itemXml, 'category')
  const guid        = get(itemXml, 'guid')
  const ediLink     = get(itemXml, 'link')
  if (!title) return null

  const descText   = stripHtml(description)
  const sale_price = parseSalePrice(title)
  if (!sale_price) return null

  const original_price = parseOriginalPrice(descText) || null
  const discount_pct   = computeDiscount(sale_price, original_price)
  const image          = extractImage(description)

  // Priority: ASIN in description → unwrapped redirect → direct merchant link
  const asin           = extractAsin(description)
  const rawMerchantUrl = asin
    ? 'https://www.amazon.com/dp/' + asin
    : extractMerchantUrl(description)

  if (!rawMerchantUrl) return null

  const product_url    = buildAffiliateUrl(rawMerchantUrl, asin || null)
  const merchant       = merchantName(rawMerchantUrl)
  const mappedCategory = mapExternalCategory
    ? mapExternalCategory(category, title)
    : categorize(title, descText)

  const isHot       = description.includes('Super Hot')
  const isLowest    = description.includes('Lowest Ever')
  const isPriceDrop = description.includes('Price Drop')
  const score =
    Math.min(discount_pct, 50) +
    (image ? 10 : 0) +
    (isHot ? 8 : 0) +
    (isLowest ? 5 : 0) +
    (isPriceDrop ? 3 : 0)

  return {
    source_key:   feedLabel,
    external_id:  guid || ediLink,
    merchant,
    source_type:  'rss',
    title:        title.replace(/\s+only\s+\$[\d.,]+\s*$/i, '').trim(),
    category:     mappedCategory,
    sale_price,
    original_price,
    discount_pct,
    product_url,
    image_url:    image || null,
    currency:     'USD',
    in_stock:     true,
    is_student_relevant: discount_pct >= 20 && ['Electronics', 'Computers', 'Phones'].includes(mappedCategory),
    is_featured:  false,
    score,
    fetched_at:   new Date().toISOString(),
    status:       'active',
  }
}

function parseFeed(xml, feedLabel) {
  const items  = []
  const itemRe = /<item>([\s\S]*?)<\/item>/gi
  let m
  while ((m = itemRe.exec(xml)) !== null) {
    try { const deal = parseItem(m[1], feedLabel); if (deal) items.push(deal) }
    catch (err) { console.warn('[edealinfo] parse error:', err.message) }
  }
  return items
}

export async function fetchEDealInfoDeals() {
  console.log('[edealinfo] Fetching', FEEDS.length, 'feeds')
  const results = await Promise.allSettled(
    FEEDS.map(async ({ url, label }) => {
      const res = await fetch(url, { headers: BROWSER_HEADERS, next: { revalidate: 0 } })
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + label)
      const xml   = await res.text()
      const deals = parseFeed(xml, label)
      console.log('[edealinfo] ' + label + ': ' + deals.length + ' deals parsed from ' + xml.length + ' bytes')
      return deals
    })
  )
  // Log any fetch failures
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error('[edealinfo] ' + FEEDS[i].label + ' failed:', r.reason?.message)
  })
  const all  = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value)
  const seen = new Set()
  return all.filter(d => {
    const asinM = d.product_url?.match(/\/dp\/([A-Z0-9]{10})/)
    const key   = asinM ? asinM[1] : d.title.slice(0, 60).toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
