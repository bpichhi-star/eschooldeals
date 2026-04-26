// lib/feeds/slickdeals.js
import { categorize }                                        from '@/lib/utils/categorize'
import { buildAffiliateUrl, extractAsin, extractExitVendor } from '@/lib/utils/affiliateUrl'

const FEEDS = [
  { url: 'https://slickdeals.net/newsearch.php?mode=popdeals&searcharea=deals&searchin=first&rss=1',                             label: 'slickdeals-popular',  thumbBonus: true  },
  { url: 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1',                            label: 'slickdeals-frontpage', thumbBonus: true  },
  { url: 'https://slickdeals.net/newsearch.php?mode=topdeals&searcharea=deals&searchin=first&rss=1',                             label: 'slickdeals-top',       thumbBonus: true  },
  { url: 'https://slickdeals.net/newsearch.php?mode=alldeals&searcharea=deals&searchin=first&rss=1',                             label: 'slickdeals-all',       thumbBonus: false },
  { url: 'https://slickdeals.net/newsearch.php?mode=popdeals&searcharea=deals&searchin=first&rss=1&forumchoice[]=9',             label: 'slickdeals-tech',      thumbBonus: true  },
  { url: 'https://slickdeals.net/newsearch.php?mode=popdeals&searcharea=deals&searchin=first&rss=1&forumchoice[]=11',            label: 'slickdeals-nontechd',  thumbBonus: false },
]

function parsePrice(text = '') {
  const m = text.match(/\$\s*([\d,]+\.?\d*)/)
  if (!m) return null
  return parseFloat(m[1].replace(/,/g, ''))
}

function parseSalePrice(title = '', description = '') {
  const finalM = description.match(/=\s*\*?\$\s*([\d,]+\.?\d*)\*?/)
  if (finalM) return parseFloat(finalM[1].replace(/,/g, ''))
  const forM = description.match(/for\s+\*\$\s*([\d,]+\.?\d*)\*/)
  if (forM) return parseFloat(forM[1].replace(/,/g, ''))
  return parsePrice(title)
}

function parseOriginalPrice(description = '') {
  const m = description.match(/list price of\s+\*?\$\s*([\d,]+\.?\d*)\*?/i)
  if (m) return parseFloat(m[1].replace(/,/g, ''))
  const typical = description.match(/typical.*?\$\s*([\d,]+\.?\d*)/i)
  if (typical) return parseFloat(typical[1].replace(/,/g, ''))
  return null
}

function parseDiscountPct(description = '') {
  const m = description.match(/\((\d+)%\s*savings?\)/i)
  return m ? parseInt(m[1], 10) : null
}

function stripHtml(html = '') { return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }

function extractImage(html = '') {
  const m = html.match(/<img[^>]+src=['"]([^'"]+)['"][^>]*>/i)
  return m ? m[1] : null
}

function extractProductUrl(html = '', asin = null, exitVendor = null) {
  if (asin && (!exitVendor || exitVendor === 'amazon.com')) return null
  const hrefRe = /data-cta="outclick"[^>]*href=['"]([^'"]+)['"]|href=['"]([^'"]+)['"][^>]*data-cta="outclick"/gi
  const hrefs = []
  let m
  while ((m = hrefRe.exec(html)) !== null) {
    const href = m[1] || m[2]
    if (href && !href.includes('slickdeals.net/click')) hrefs.push(href)
  }
  if (exitVendor && hrefs.length === 0) {
    const domainRe = new RegExp(`href=['"]([^'"]*${exitVendor.replace('.', '\\.')}[^'"]+)['"]`, 'i')
    const dm = html.match(domainRe)
    if (dm) return dm[1]
  }
  return hrefs[0] || null
}

function parseItem(itemXml, feedLabel, thumbBonus) {
  const get = (tag) => {
    const re = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([^<]*)</${tag}>`, 'i')
    const m = itemXml.match(re)
    return m ? (m[1] || m[2] || '').trim() : ''
  }
  const title       = get('title')
  const link        = get('link')
  const description = stripHtml(get('description'))
  const encoded     = get('content:encoded')
  const guid        = get('guid')
  if (!title) return null
  const asin       = extractAsin(encoded)
  const exitVendor = extractExitVendor(encoded)
  const image      = extractImage(encoded)
  const sale_price = parseSalePrice(title, description)
  if (!sale_price) return null
  const original_price = parseOriginalPrice(description)
  const discount_pct   = parseDiscountPct(description) ??
    (original_price && sale_price ? Math.round((1 - sale_price / original_price) * 100) : 0)
  const rawVendorUrl = extractProductUrl(encoded, asin, exitVendor)
  const product_url  = buildAffiliateUrl(rawVendorUrl || link, asin)
  const merchant     = exitVendor ? exitVendor.replace('.com', '').toUpperCase() : 'SLICKDEALS'
  const category     = categorize(title, description)
  const thumbM       = encoded.match(/Thumb Score:\s*\+?(-?\d+)/)
  const thumbScore   = thumbM ? parseInt(thumbM[1], 10) : 0
  const score = Math.min(discount_pct ?? 0, 50) + (image ? 10 : 0) +
    (thumbBonus && thumbScore > 5 ? 15 : 0) + (thumbBonus && thumbScore > 15 ? 10 : 0)
  return {
    source_key: feedLabel, external_id: guid || link, merchant, source_type: 'rss',
    title: title.replace(/^\$[\d,.]+\s*\|?\s*/, '').trim(),
    category, sale_price, original_price: original_price || null, discount_pct: discount_pct || 0,
    product_url, image_url: image || null, currency: 'USD', in_stock: true,
    is_student_relevant: discount_pct >= 20 && ['Electronics','Computers','Phones'].includes(category),
    is_featured: false, score, fetched_at: new Date().toISOString(), status: 'active',
  }
}

function parseFeed(xml, feedLabel, thumbBonus) {
  const items = []
  const itemRe = /<item>([\s\S]*?)<\/item>/gi
  let m
  while ((m = itemRe.exec(xml)) !== null) {
    try { const deal = parseItem(m[1], feedLabel, thumbBonus); if (deal) items.push(deal) }
    catch (err) { console.warn('[slickdeals] parse error:', err.message) }
  }
  return items
}

export async function fetchSlickdealsDeals() {
  console.log('[slickdeals] Fetching', FEEDS.length, 'feeds')
  const results = await Promise.allSettled(
    FEEDS.map(async ({ url, label, thumbBonus }) => {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; eschooldeals-bot/1.0)' }, next: { revalidate: 0 } })
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${label}`)
      const xml = await res.text()
      const deals = parseFeed(xml, label, thumbBonus)
      console.log(`[slickdeals] ${label}: ${deals.length} deals`)
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
