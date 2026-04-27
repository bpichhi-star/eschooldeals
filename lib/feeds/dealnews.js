// lib/feeds/dealnews.js
import { categorize, mapExternalCategory } from '@/lib/utils/categorize'
import { buildAffiliateUrl } from '@/lib/utils/affiliateUrl'

const FEEDS = [
  { url: 'https://dealnews.com/featured/rss.xml',     label: 'dealnews-featured' },
  { url: 'https://dealnews.com/l2/tech/rss.xml',      label: 'dealnews-tech' },
  { url: 'https://dealnews.com/l2/computers/rss.xml', label: 'dealnews-computers' },
]

function get(xml, tag) {
  const re = new RegExp('<' + tag + '[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></' + tag + '>|<' + tag + '[^>]*>([^<]*)</' + tag + '>', 'i')
  const m = xml.match(re)
  return m ? (m[1] || m[2] || '').trim() : ''
}

function stripHtml(html = '') { return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }

function extractImage(itemXml = '') {
  const m1 = itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)
  if (m1) return m1[1]
  const m2 = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image/i)
  if (m2) return m2[1]
  const m3 = itemXml.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (m3) return m3[1]
  return null
}

function parseSalePrice(title = '') {
  const onlyM = title.match(/only\s+\$\s*([\d,]+\.?\d*)/i)
  if (onlyM) return parseFloat(onlyM[1].replace(/,/g, ''))
  const rangeM = title.match(/\$\s*([\d,]+\.?\d*)\s*[-\u2013]\s*\$\s*([\d,]+\.?\d*)/)
  if (rangeM) return parseFloat(rangeM[1].replace(/,/g, ''))
  const m = title.match(/\$\s*([\d,]+\.?\d*)/)
  return m ? parseFloat(m[1].replace(/,/g, '')) : null
}

function parseOriginalPrice(desc = '') {
  const patterns = [
    /was\s+\$\s*([\d,]+\.?\d*)/i,
    /reg(?:ular)?\s+\$\s*([\d,]+\.?\d*)/i,
    /list\s+\$\s*([\d,]+\.?\d*)/i,
    /\(\s*a\s+\$\s*([\d,]+\.?\d*)\s+value\)/i,
    /Compare.*?\$\s*([\d,]+\.?\d*)/i,
  ]
  for (const re of patterns) {
    const m = desc.match(re)
    if (m) return parseFloat(m[1].replace(/,/g, ''))
  }
  return null
}

function computeDiscount(sale, original) {
  if (!original || !sale || original <= sale) return 0
  return Math.round((1 - sale / original) * 100)
}

function parseItem(itemXml, feedLabel) {
  const title = get(itemXml, 'title')
  const link = get(itemXml, 'link') || (itemXml.match(/<link>([^<]+)<\/link>/) || [])[1]?.trim() || ''
  const description = get(itemXml, 'description')
  const category = get(itemXml, 'category')
  const guid = get(itemXml, 'guid')
  if (!title || !link) return null
  const descText = stripHtml(description)
  const sale_price = parseSalePrice(title)
  if (!sale_price) return null
  const original_price = parseOriginalPrice(descText) || null
  const discount_pct = computeDiscount(sale_price, original_price)
  const image = extractImage(itemXml)
  const mappedCategory = mapExternalCategory
    ? mapExternalCategory(category, title)
    : categorize(title, descText)
  const product_url = buildAffiliateUrl(link)
  const isHot = /hot deal|blazing|crazy/i.test(descText)
  const isLowest = /lowest price|lowest ever|all-time low/i.test(descText)
  const score = Math.min(discount_pct, 50) + (image ? 10 : 0) + (isHot ? 8 : 0) + (isLowest ? 5 : 0)
  return {
    source_key: feedLabel, external_id: guid || link, merchant: 'DEALNEWS',
    source_type: 'rss',
    title: title.replace(/\s+only\s+\$[\d.,]+\s*$/i, '').trim().slice(0, 255),
    category: mappedCategory, sale_price, original_price, discount_pct,
    product_url, image_url: image || null, currency: 'USD', in_stock: true,
    is_student_relevant: discount_pct >= 20 && ['Electronics', 'Computers', 'Phones'].includes(mappedCategory),
    is_featured: false, score, fetched_at: new Date().toISOString(), status: 'active',
  }
}

function parseFeed(xml, feedLabel) {
  const items = [], itemRe = /<item>([\s\S]*?)<\/item>/gi
  let m
  while ((m = itemRe.exec(xml)) !== null) {
    try { const deal = parseItem(m[1], feedLabel); if (deal) items.push(deal) }
    catch (err) { console.warn('[dealnews] parse error:', err.message) }
  }
  return items
}

export async function fetchDealNewsDeals() {
  console.log('[dealnews] Fetching', FEEDS.length, 'feeds')
  const results = await Promise.allSettled(
    FEEDS.map(async ({ url, label }) => {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          'Referer': 'https://www.google.com/',
        },
        next: { revalidate: 0 },
      })
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + label)
      const xml = await res.text()
      const deals = parseFeed(xml, label)
      console.log('[dealnews] ' + label + ': ' + deals.length + ' deals')
      return deals
    })
  )
  const all = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value)
  const seen = new Set()
  return all.filter(d => {
    if (seen.has(d.external_id)) return false
    seen.add(d.external_id)
    return true
  })
}
