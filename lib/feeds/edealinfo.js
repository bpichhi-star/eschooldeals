// lib/feeds/edealinfo.js
import { categorize, mapExternalCategory } from '@/lib/utils/categorize'
import { buildAffiliateUrl }               from '@/lib/utils/affiliateUrl'

const FEEDS = [
  { url: 'https://www.edealinfo.com/deals-rss.php',             label: 'edealinfo-all'      },
  { url: 'https://www.edealinfo.com/deals-rss.php?s=top',       label: 'edealinfo-top'      },
  { url: 'https://www.edealinfo.com/deals-rss.php?cat=comp',    label: 'edealinfo-tech'     },
  { url: 'https://www.edealinfo.com/deals-rss.php?cat=nontech', label: 'edealinfo-nontechd' },
]

function get(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([^<]*)</${tag}>`, 'i')
  const m = xml.match(re)
  return m ? (m[1] || m[2] || '').trim() : ''
}

function stripHtml(html = '') { return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }

function extractAsinFromImage(html = '') {
  const m = html.match(/amazon\.com\/dp\/([A-Z0-9]{10})/i)
  return m ? m[1] : null
}

function extractImage(html = '') {
  const m = html.match(/src=['"]([^'"]+m\.media-amazon\.com[^'"]+|[^'"]+ebayimg\.com[^'"]+|[^'"]+macysassets[^'"]+)['"]/)
  return m ? m[1].replace(/_AA200_/, '_SL500_') : null
}

function extractVendor(html = '') {
  if (html.includes('amazon.com') || html.includes('m.media-amazon.com')) return 'amazon.com'
  if (html.includes('walmart.com'))    return 'walmart.com'
  if (html.includes('ebay.com') || html.includes('ebayimg.com')) return 'ebay.com'
  if (html.includes('bestbuy.com'))    return 'bestbuy.com'
  if (html.includes('macysassets') || html.includes('macys.com')) return 'macys.com'
  if (html.includes('target.com'))     return 'target.com'
  return 'other'
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
  const link        = get(itemXml, 'link')
  const description = get(itemXml, 'description')
  const category    = get(itemXml, 'category')
  const guid        = get(itemXml, 'guid')
  if (!title) return null
  const descText       = stripHtml(description)
  const sale_price     = parseSalePrice(title)
  if (!sale_price) return null
  const original_price = parseOriginalPrice(descText) || null
  const discount_pct   = computeDiscount(sale_price, original_price)
  const asin           = extractAsinFromImage(description)
  const vendor         = extractVendor(description, link)
  const image          = extractImage(description)
  const product_url    = buildAffiliateUrl(asin ? `https://www.amazon.com/dp/${asin}` : link, asin)
  const merchant       = vendor.replace('.com', '').toUpperCase()
  const mappedCategory = mapExternalCategory(category, title)
  const isHot = description.includes('Super Hot')
  const isLowest = description.includes('Lowest Ever')
  const isPriceDrop = description.includes('Price Drop')
  const score = Math.min(discount_pct, 50) + (image ? 10 : 0) + (isHot ? 8 : 0) + (isLowest ? 5 : 0) + (isPriceDrop ? 3 : 0)
  return {
    source_key: feedLabel, external_id: guid || link, merchant, source_type: 'rss',
    title: title.replace(/\s+only\s+\$[\d.,]+\s*$/i, '').trim(),
    category: mappedCategory, sale_price, original_price, discount_pct, product_url,
    image_url: image || null, currency: 'USD', in_stock: true,
    is_student_relevant: discount_pct >= 20 && ['Electronics','Computers','Phones'].includes(mappedCategory),
    is_featured: false, score, fetched_at: new Date().toISOString(), status: 'active',
  }
}

function parseFeed(xml, feedLabel) {
  const items = []
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
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; eschooldeals-bot/1.0)' }, next: { revalidate: 0 } })
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${label}`)
      const xml = await res.text()
      const deals = parseFeed(xml, label)
      console.log(`[edealinfo] ${label}: ${deals.length} deals`)
      return deals
    })
  )
  const all = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value)
  const seen = new Set()
  return all.filter(d => {
    const asinM = d.product_url?.match(/\/dp\/([A-Z0-9]{10})/)
    const key = asinM ? asinM[1] : d.title.slice(0, 60).toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
