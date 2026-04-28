// lib/feeds/dealnews.js
import { categorize, mapExternalCategory } from '@/lib/utils/categorize'
import { buildAffiliateUrl } from '@/lib/utils/affiliateUrl'

const FEEDS = [
  { url: 'https://dealnews.com/featured/rss.xml',     label: 'dealnews-featured' },
  { url: 'https://dealnews.com/l2/tech/rss.xml',      label: 'dealnews-tech' },
  { url: 'https://dealnews.com/l2/computers/rss.xml', label: 'dealnews-computers' },
]

// FIX: dealnews.com removed from blocklist — their links are tracking redirects we unwrap
// Only block true aggregators that are never the final merchant
const HARD_AGGREGATORS = new Set(['slickdeals.net', 'edealinfo.com', 'dealsea.com', 'dealsplus.com'])

function isHardAggregator(url = '') {
  try { return HARD_AGGREGATORS.has(new URL(url).hostname.replace('www.', '')) }
  catch { return false }
}

// FIX: unwrap DealNews tracking links e.g. dealnews.com/l/click.html?eurl=https%3A%2F%2Famazon.com
function unwrapDnUrl(href = '') {
  if (!href.includes('dealnews.com')) return href
  try {
    const u = new URL(href)
    for (const param of ['eurl', 'url', 'u', 'dest', 'link', 'to', 'target']) {
      const val = u.searchParams.get(param)
      if (val) {
        const decoded = decodeURIComponent(val)
        if (decoded.startsWith('http')) return decoded
        const twice = decodeURIComponent(decoded)
        if (twice.startsWith('http')) return twice
      }
    }
  } catch {}
  return null // dealnews article page — not a merchant link
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
    // FIX: unwrap instead of block
    if (href.includes('dealnews.com')) { href = unwrapDnUrl(href); if (!href) continue }
    if (isHardAggregator(href)) continue
    return href
  }
  return null
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
      'apple.com':'APPLE','samsung.com':'SAMSUNG','gamestop.com':'GAMESTOP','antonline.com':'ANTONLINE',
    }
    return map[host] || host.split('.')[0].toUpperCase()
  } catch { return 'STORE' }
}

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
  return m3 ? m3[1] : null
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
  for (const re of [/was\s+\$\s*([\d,]+\.?\d*)/i, /reg(?:ular)?\s+\$\s*([\d,]+\.?\d*)/i, /list\s+\$\s*([\d,]+\.?\d*)/i]) {
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
  const title = get(itemXml, 'title'), description = get(itemXml, 'description')
  const category = get(itemXml, 'category'), guid = get(itemXml, 'guid')
  const dnLink = get(itemXml, 'link') || (itemXml.match(/<link>([^<]+)<\/link>/) || [])[1]?.trim() || ''
  if (!title) return null
  const descText = stripHtml(description)
  const sale_price = parseSalePrice(title)
  if (!sale_price) return null
  const original_price = parseOriginalPrice(descText) || null
  const discount_pct = computeDiscount(sale_price, original_price)
  const image = extractImage(itemXml)
  // FIX: extractMerchantUrl now unwraps dealnews tracking links instead of blocking them
  const rawMerchantUrl = extractMerchantUrl(description) || extractMerchantUrl(itemXml)
  if (!rawMerchantUrl) return null
  const mappedCategory = mapExternalCategory ? mapExternalCategory(category, title) : categorize(title, descText)
  const isHot = /hot deal|blazing|crazy/i.test(descText), isLowest = /lowest price|lowest ever/i.test(descText)
  const score = Math.min(discount_pct, 50) + (image ? 10 : 0) + (isHot ? 8 : 0) + (isLowest ? 5 : 0)
  return {
    source_key: feedLabel, external_id: guid || dnLink, merchant: merchantName(rawMerchantUrl),
    source_type: 'rss', title: title.replace(/\s+only\s+\$[\d.,]+\s*$/i, '').trim().slice(0, 255),
    category: mappedCategory, sale_price, original_price, discount_pct,
    product_url: buildAffiliateUrl(rawMerchantUrl),
    image_url: image || null, currency: 'USD', in_stock: true,
    is_student_relevant: discount_pct >= 20 && ['Electronics','Computers','Phones'].includes(mappedCategory),
    is_featured: false, score, fetched_at: new Date().toISOString(), status: 'active',
  }
}

function parseFeed(xml, feedLabel) {
  const items = [], itemRe = /<item>([\s\S]*?)<\/item>/gi
  let m
  while ((m = itemRe.exec(xml)) !== null) {
    try { const d = parseItem(m[1], feedLabel); if (d) items.push(d) } catch (e) { console.warn('[dealnews] parse error:', e.message) }
  }
  return items
}

export async function fetchDealNewsDeals() {
  console.log('[dealnews] Fetching', FEEDS.length, 'feeds')
  const results = await Promise.allSettled(
    FEEDS.map(async ({ url, label }) => {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 'Accept': 'application/rss+xml, application/xml, text/xml, */*', 'Referer': 'https://www.google.com/' },
        next: { revalidate: 0 },
      })
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + label)
      const xml = await res.text()
      const deals = parseFeed(xml, label)
      console.log('[dealnews] ' + label + ': ' + deals.length + ' deals from ' + xml.length + ' bytes')
      return deals
    })
  )
  results.forEach((r, i) => { if (r.status === 'rejected') console.error('[dealnews] ' + FEEDS[i].label + ' failed:', r.reason?.message) })
  const all = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value)
  const seen = new Set()
  return all.filter(d => { if (seen.has(d.external_id)) return false; seen.add(d.external_id); return true })
}
