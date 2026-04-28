// lib/feeds/edealinfo.js
// eDealInfo blocks Vercel's server IPs via Cloudflare (confirmed 403).
// Solution: route through rss2json.com — a trusted RSS proxy with clean IPs.
// Vercel → rss2json.com → eDealInfo (bypasses Cloudflare IP block).
// rss2json returns clean JSON — no XML parsing needed.

import { categorize, mapExternalCategory } from '@/lib/utils/categorize'
import { buildAffiliateUrl } from '@/lib/utils/affiliateUrl'

const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url='

const FEEDS = [
  { url: 'https://www.edealinfo.com/deals-rss.php',             label: 'edealinfo-all' },
  { url: 'https://www.edealinfo.com/deals-rss.php?s=top',       label: 'edealinfo-top' },
  { url: 'https://www.edealinfo.com/deals-rss.php?cat=comp',    label: 'edealinfo-tech' },
  { url: 'https://www.edealinfo.com/deals-rss.php?cat=nontech', label: 'edealinfo-nontech' },
]

const OTHER_AGGREGATORS = new Set(['slickdeals.net', 'dealnews.com', 'dealsea.com', 'dealsplus.com'])

function isOtherAggregator(url = '') {
  try { return OTHER_AGGREGATORS.has(new URL(url).hostname.replace('www.', '')) }
  catch { return false }
}

// eDealInfo wraps links as: edealinfo.com/go.php?u=https%3A%2F%2Famazon.com%2F...
function unwrapEdiUrl(href = '') {
  if (!href.includes('edealinfo.com')) return href
  try {
    const u = new URL(href)
    for (const param of ['u', 'url', 'dest', 'destination', 'target', 'link', 'goto', 'out', 'to']) {
      const val = u.searchParams.get(param)
      if (val) {
        const decoded = decodeURIComponent(val)
        if (decoded.startsWith('http')) return decoded
        const twice = decodeURIComponent(decoded)
        if (twice.startsWith('http')) return twice
      }
    }
  } catch {}
  return null
}

function extractMerchantUrl(html = '') {
  const decoded = html
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
  const hrefRe = /href=["']([^"']+)["']/gi
  let m
  while ((m = hrefRe.exec(decoded)) !== null) {
    let href = m[1].trim()
    if (!href.startsWith('http')) continue
    if (/\.(jpg|jpeg|png|gif|webp|svg|css|js)|pixel|beacon/i.test(href)) continue
    if (href.includes('edealinfo.com')) { href = unwrapEdiUrl(href); if (!href) continue }
    if (isOtherAggregator(href)) continue
    return href
  }
  return null
}

function extractAsin(text = '') {
  const m = text.match(/(?:amazon\.com\/(?:dp|gp\/product)\/|asin=)([A-Z0-9]{10})/i)
  return m ? m[1] : null
}

function merchantName(url = '') {
  try {
    const host = new URL(url).hostname.replace('www.', '')
    const map = {
      'amazon.com':'AMAZON','amzn.to':'AMAZON','walmart.com':'WALMART','woot.com':'WOOT',
      'bestbuy.com':'BEST BUY','target.com':'TARGET','ebay.com':'EBAY',
      'homedepot.com':'HOME DEPOT',"lowes.com":"LOWE'S",'newegg.com':'NEWEGG',
      'costco.com':'COSTCO','adorama.com':'ADORAMA','bhphotovideo.com':'B&H',
      "macys.com":"MACY'S",'lenovo.com':'LENOVO','dell.com':'DELL','hp.com':'HP',
      'apple.com':'APPLE','samsung.com':'SAMSUNG','gamestop.com':'GAMESTOP',
    }
    return map[host] || host.split('.')[0].toUpperCase()
  } catch { return 'STORE' }
}

function parseSalePrice(title = '') {
  const a = title.match(/only\s+\$\s*([\d,]+\.?\d*)/i)
  if (a) return parseFloat(a[1].replace(/,/g, ''))
  const b = title.match(/\$\s*([\d,]+\.?\d*)\s*[-\u2013]\s*\$\s*([\d,]+\.?\d*)/)
  if (b) return parseFloat(b[1].replace(/,/g, ''))
  const c = title.match(/\$\s*([\d,]+\.?\d*)/)
  return c ? parseFloat(c[1].replace(/,/g, '')) : null
}

function parseOriginalPrice(desc = '') {
  const re = /Compare.*?\(\$\s*([\d,]+\.?\d*)\)/gi
  let highest = null, m
  while ((m = re.exec(desc)) !== null) {
    const p = parseFloat(m[1].replace(/,/g, ''))
    if (!highest || p > highest) highest = p
  }
  if (!highest) {
    const w = desc.match(/(?:was|reg|list)\s*:?\s*\$\s*([\d,]+\.?\d*)/i)
    if (w) highest = parseFloat(w[1].replace(/,/g, ''))
  }
  return highest
}

function computeDiscount(sale, orig) {
  if (!orig || !sale || orig <= sale) return 0
  return Math.round((1 - sale / orig) * 100)
}

// rss2json returns items as JSON objects with: title, link, description, content, pubDate, categories, thumbnail
function parseItem(item, feedLabel) {
  const title    = (item.title || '').trim()
  const ediLink  = item.link || ''
  const desc     = item.description || item.content || ''
  const category = (item.categories || [])[0] || ''
  const guid     = item.guid || ediLink

  if (!title) return null
  const sale_price = parseSalePrice(title)
  if (!sale_price) return null

  const descText     = desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const original_price = parseOriginalPrice(descText) || null
  const discount_pct   = computeDiscount(sale_price, original_price)

  // rss2json puts the thumbnail in item.thumbnail
  const image = item.thumbnail || null

  // Priority: ASIN → unwrap href → unwrap ediLink
  const asin = extractAsin(desc + ' ' + ediLink)
  const rawMerchantUrl = asin
    ? 'https://www.amazon.com/dp/' + asin
    : extractMerchantUrl(desc) || unwrapEdiUrl(ediLink)

  if (!rawMerchantUrl || rawMerchantUrl.includes('edealinfo.com')) return null

  const product_url    = buildAffiliateUrl(rawMerchantUrl, asin || null)
  const merchant       = asin ? 'AMAZON' : merchantName(rawMerchantUrl)
  const mappedCategory = mapExternalCategory ? mapExternalCategory(category, title) : categorize(title, descText)
  const isHot = desc.includes('Super Hot'), isLowest = desc.includes('Lowest Ever')
  const score = Math.min(discount_pct, 50) + (image ? 10 : 0) + (isHot ? 8 : 0) + (isLowest ? 5 : 0)

  return {
    source_key: feedLabel, external_id: guid, merchant, source_type: 'rss',
    title: title.replace(/\s+only\s+\$[\d.,]+\s*$/i, '').trim(),
    category: mappedCategory, sale_price, original_price, discount_pct,
    product_url, image_url: image, currency: 'USD', in_stock: true,
    is_student_relevant: discount_pct >= 20 && ['Electronics','Computers','Phones'].includes(mappedCategory),
    is_featured: false, score, fetched_at: new Date().toISOString(), status: 'active',
  }
}

async function fetchFeed({ url, label }) {
  const proxyUrl = RSS2JSON + encodeURIComponent(url)
  let res
  try {
    res = await fetch(proxyUrl, { next: { revalidate: 0 } })
  } catch(e) {
    throw new Error('rss2json fetch error for ' + label + ': ' + e.message)
  }
  if (!res.ok) throw new Error('rss2json HTTP ' + res.status + ' for ' + label)
  const data = await res.json()
  if (data.status !== 'ok') throw new Error('rss2json error for ' + label + ': ' + data.message)
  const items = data.items || []
  const deals = items.map(item => parseItem(item, label)).filter(Boolean)
  console.log('[edealinfo] ' + label + ': ' + deals.length + ' deals from ' + items.length + ' items')
  return deals
}

export async function fetchEDealInfoDeals() {
  console.log('[edealinfo] Fetching', FEEDS.length, 'feeds via rss2json proxy')
  const results = await Promise.allSettled(FEEDS.map(fetchFeed))
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error('[edealinfo] ' + FEEDS[i].label + ' failed:', r.reason?.message)
  })
  const all  = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value)
  const seen = new Set()
  return all.filter(d => {
    const key = d.external_id || d.title.slice(0, 60)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
