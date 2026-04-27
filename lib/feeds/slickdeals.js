// lib/feeds/slickdeals.js
import { categorize } from '@/lib/utils/categorize'
import { buildAffiliateUrl, detectVendor } from '@/lib/utils/affiliateUrl'

const FEEDS = [
  { url: 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1', label: 'slickdeals-frontpage' },
  { url: 'https://slickdeals.net/newsearch.php?mode=popdeals&searcharea=deals&searchin=first&rss=1',  label: 'slickdeals-popular' },
  { url: 'https://slickdeals.net/newsearch.php?mode=topdeals&searcharea=deals&searchin=first&rss=1',  label: 'slickdeals-top' },
]

// Domains we never want to surface as the merchant source
const AGGREGATOR_DOMAINS = new Set([
  'slickdeals.net', 'edealinfo.com', 'dealnews.com',
  'dealsea.com', 'dealsplus.com', 'bfads.net', 'gottadeal.com',
])

function isAggregatorUrl(url = '') {
  try {
    const host = new URL(url).hostname.replace('www.', '')
    return AGGREGATOR_DOMAINS.has(host)
  } catch { return false }
}

// Pull the first real merchant href out of an HTML string
function extractMerchantUrl(html = '') {
  const hrefRe = /href=["']([^"']+)["']/gi
  let m
  while ((m = hrefRe.exec(html)) !== null) {
    const href = m[1]
    if (!href.startsWith('http')) continue
    if (isAggregatorUrl(href)) continue
    // Skip image/asset/tracking URLs
    if (/\.(jpg|jpeg|png|gif|webp|svg|css|js)|pixel|beacon|track|click\.php/i.test(href)) continue
    return href
  }
  return null
}

// Vendor display name from URL
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
      'gamestop.com': 'GAMESTOP', 'antonline.com': 'ANTONLINE',
    }
    return map[host] || host.split('.')[0].toUpperCase()
  } catch { return 'STORE' }
}

function extractPrices(text = '') {
  const matches = [...text.matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g)]
  return matches
    .map(m => parseFloat(m[1].replace(/,/g, '')))
    .filter(p => p > 0 && p < 10000)
    .sort((a, b) => b - a)
}

function stripHtml(html = '') {
  return html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim()
}

function extractLink(itemXml = '') {
  const linkM = itemXml.match(/<link>([^<]+)<\/link>/)
  if (linkM) return linkM[1].trim()
  const guidM = itemXml.match(/<guid[^>]*>([^<]+)<\/guid>/)
  return guidM ? guidM[1].trim() : ''
}

function extractCDATA(tag, xml) {
  const re = new RegExp('<' + tag + '[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/' + tag + '>|<' + tag + '[^>]*>([^<]*)<\/' + tag + '>', 'i')
  const m = xml.match(re)
  return m ? (m[1] || m[2] || '').trim() : ''
}

function extractImage(html = '') {
  const m = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
  return m ? m[1] : null
}

function parseItem(itemXml, feedLabel) {
  const title   = extractCDATA('title', itemXml)
  const sdLink  = extractLink(itemXml)             // slickdeals.net URL — never shown to user
  const desc    = extractCDATA('description', itemXml)
  const encoded = extractCDATA('content:encoded', itemXml)
  const guid    = extractCDATA('guid', itemXml)
  if (!title || !sdLink) return null

  const descText = stripHtml(desc)
  const combinedText = title + ' ' + descText

  const prices = extractPrices(combinedText)
  if (prices.length === 0) return null

  const sale_price    = Math.min(...prices)
  const original_price = prices.length > 1 && Math.max(...prices) > sale_price * 1.05 ? Math.max(...prices) : null
  const discount_pct  = original_price ? Math.round((1 - sale_price / original_price) * 100) : 0

  const image = extractImage(encoded || '')

  // Extract real merchant URL from description HTML — never expose slickdeals URL
  const rawMerchantUrl = extractMerchantUrl(desc) || extractMerchantUrl(encoded || '')
  const product_url    = rawMerchantUrl ? buildAffiliateUrl(rawMerchantUrl) : null

  // If we couldn't find a merchant URL, skip this deal entirely
  if (!product_url) return null

  const merchant = merchantName(rawMerchantUrl)
  const category = categorize(title, descText)

  const score =
    Math.min(discount_pct, 50) +
    (image ? 10 : 0) +
    (/free shipping|free s&h/i.test(combinedText) ? 5 : 0)

  return {
    source_key:    feedLabel,
    external_id:   guid || sdLink,
    merchant,
    source_type:   'rss',
    title:         title.slice(0, 255),
    category,
    sale_price,
    original_price,
    discount_pct,
    product_url,
    image_url:     image || null,
    currency:      'USD',
    in_stock:      true,
    is_student_relevant: ['Electronics', 'Computers', 'Phones'].includes(category) && (discount_pct >= 15 || sale_price < 100),
    is_featured:   false,
    score,
    fetched_at:    new Date().toISOString(),
    status:        'active',
  }
}

function parseFeed(xml, feedLabel) {
  const items  = []
  const itemRe = /<item>([\s\S]*?)<\/item>/gi
  let m
  while ((m = itemRe.exec(xml)) !== null) {
    try { const d = parseItem(m[1], feedLabel); if (d) items.push(d) }
    catch (e) { console.warn('[slickdeals] parse error:', e.message) }
  }
  return items
}

export async function fetchSlickdealsDeals() {
  console.log('[slickdeals] Fetching', FEEDS.length, 'feeds')
  const results = await Promise.allSettled(
    FEEDS.map(async ({ url, label }) => {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
        next: { revalidate: 0 },
      })
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + label)
      const xml   = await res.text()
      const deals = parseFeed(xml, label)
      console.log('[slickdeals] ' + label + ': ' + deals.length + ' deals')
      return deals
    })
  )
  const all  = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value)
  const seen = new Set()
  return all.filter(d => {
    if (seen.has(d.external_id)) return false
    seen.add(d.external_id)
    return true
  })
}
