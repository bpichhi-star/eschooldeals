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

const OTHER_AGGREGATORS = new Set([
  'slickdeals.net', 'dealnews.com', 'dealsea.com', 'dealsplus.com', 'bfads.net',
])

function isOtherAggregator(url = '') {
  try { return OTHER_AGGREGATORS.has(new URL(url).hostname.replace('www.', '')) }
  catch { return false }
}

// FIX: handle multiple redirect param names + double-encoding
function unwrapOrSkipEdiUrl(href = '') {
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

// FIX: decode HTML entities before scanning hrefs
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
    if (href.includes('edealinfo.com')) { href = unwrapOrSkipEdiUrl(href); if (!href) continue }
    if (isOtherAggregator(href)) continue
    return href
  }
  return null
}

function extractAsin(html = '') {
  const m = html.match(/(?:amazon\.com\/(?:dp|gp\/product|exec\/obidos\/ASIN)\/|asin=)([A-Z0-9]{10})/i)
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

function get(xml, tag) {
  const re = new RegExp('<' + tag + '[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></' + tag + '>|<' + tag + '[^>]*>([^<]*)</' + tag + '>', 'i')
  const m = xml.match(re)
  return m ? (m[1] || m[2] || '').trim() : ''
}

function stripHtml(html = '') { return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }

function extractImage(html = '') {
  const a = html.match(/src=['"]([^'"]+m\.media-amazon\.com[^'"]+)['"]/)
  if (a) return a[1].replace(/_AA200_/, '_SL500_')
  const b = html.match(/src=['"]([^'"]+ebayimg\.com[^'"]+)['"]/)
  if (b) return b[1]
  const c = html.match(/<img[^>]+src=['"]([^'"]+)['"]/)
  return c ? c[1] : null
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
    const w = desc.match(/(?:was|reg|list|original)\s*:?\s*\$\s*([\d,]+\.?\d*)/i)
    if (w) highest = parseFloat(w[1].replace(/,/g, ''))
  }
  return highest
}

function computeDiscount(sale, original) {
  if (!original || !sale || original <= sale) return 0
  return Math.round((1 - sale / original) * 100)
}

function parseItem(itemXml, feedLabel) {
  const title = get(itemXml, 'title'), description = get(itemXml, 'description')
  const category = get(itemXml, 'category'), guid = get(itemXml, 'guid'), ediLink = get(itemXml, 'link')
  if (!title) return null
  const descText = stripHtml(description)
  const sale_price = parseSalePrice(title)
  if (!sale_price) return null
  const original_price = parseOriginalPrice(descText) || null
  const discount_pct = computeDiscount(sale_price, original_price)
  const image = extractImage(description)
  const mappedCategory = mapExternalCategory ? mapExternalCategory(category, title) : categorize(title, descText)
  const isHot = description.includes('Super Hot'), isLowest = description.includes('Lowest Ever')
  const baseScore = Math.min(discount_pct, 50) + (image ? 10 : 0) + (isHot ? 8 : 0) + (isLowest ? 5 : 0)

  // Strategy 1: ASIN found anywhere
  const asin = extractAsin(description + ' ' + ediLink)
  if (asin) {
    return {
      source_key: feedLabel, external_id: guid || ediLink, merchant: 'AMAZON', source_type: 'rss',
      title: title.replace(/\s+only\s+\$[\d.,]+\s*$/i, '').trim(), category: mappedCategory,
      sale_price, original_price, discount_pct,
      product_url: buildAffiliateUrl('https://www.amazon.com/dp/' + asin, asin),
      image_url: image || null, currency: 'USD', in_stock: true,
      is_student_relevant: discount_pct >= 20 && ['Electronics','Computers','Phones'].includes(mappedCategory),
      is_featured: false, score: baseScore, fetched_at: new Date().toISOString(), status: 'active',
    }
  }

  // FIX Strategy 2: try description hrefs, then fall back to unwrapping ediLink directly
  const rawMerchantUrl = extractMerchantUrl(description) || unwrapOrSkipEdiUrl(ediLink)
  if (!rawMerchantUrl || rawMerchantUrl.includes('edealinfo.com')) return null

  return {
    source_key: feedLabel, external_id: guid || ediLink, merchant: merchantName(rawMerchantUrl),
    source_type: 'rss', title: title.replace(/\s+only\s+\$[\d.,]+\s*$/i, '').trim(),
    category: mappedCategory, sale_price, original_price, discount_pct,
    product_url: buildAffiliateUrl(rawMerchantUrl, null),
    image_url: image || null, currency: 'USD', in_stock: true,
    is_student_relevant: discount_pct >= 20 && ['Electronics','Computers','Phones'].includes(mappedCategory),
    is_featured: false, score: baseScore, fetched_at: new Date().toISOString(), status: 'active',
  }
}

function parseFeed(xml, feedLabel) {
  const items = [], itemRe = /<item>([\s\S]*?)<\/item>/gi
  let m
  while ((m = itemRe.exec(xml)) !== null) {
    try { const d = parseItem(m[1], feedLabel); if (d) items.push(d) }
    catch (e) { console.warn('[edealinfo] parse error:', e.message) }
  }
  return items
}

export async function fetchEDealInfoDeals() {
  console.log('[edealinfo] Fetching', FEEDS.length, 'feeds')
  const results = await Promise.allSettled(
    FEEDS.map(async ({ url, label }) => {
      const res = await fetch(url, { headers: BROWSER_HEADERS, next: { revalidate: 0 } })
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + label)
      const xml = await res.text()
      const deals = parseFeed(xml, label)
      console.log('[edealinfo] ' + label + ': ' + deals.length + ' deals from ' + xml.length + ' bytes')
      return deals
    })
  )
  results.forEach((r, i) => { if (r.status === 'rejected') console.error('[edealinfo] ' + FEEDS[i].label + ' failed:', r.reason?.message) })
  const all = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value)
  const seen = new Set()
  return all.filter(d => { const k = d.external_id || d.title.slice(0,60); if (seen.has(k)) return false; seen.add(k); return true })
}
