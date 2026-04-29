// lib/feeds/slickdeals.js
// Diagnostic confirmed: Slickdeals RSS descriptions have NO merchant hrefs.
// We extract merchant from title text instead ("Product at Amazon for $X")
// and build an affiliate search URL. Never exposes slickdeals.net to users.
import { categorize } from '@/lib/utils/categorize'
import { buildAffiliateUrl } from '@/lib/utils/affiliateUrl'

const FEEDS = [
  { url: 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1', label: 'slickdeals-frontpage' },
  { url: 'https://slickdeals.net/newsearch.php?mode=popdeals&searcharea=deals&searchin=first&rss=1',  label: 'slickdeals-popular' },
  { url: 'https://slickdeals.net/newsearch.php?mode=topdeals&searcharea=deals&searchin=first&rss=1',  label: 'slickdeals-top' },
]

const MERCHANTS = [
  { key: 'amazon',      name: 'AMAZON',      base: 'https://www.amazon.com',        search: (q) => '/s?k=' + q },
  { key: 'amzn',        name: 'AMAZON',      base: 'https://www.amazon.com',        search: (q) => '/s?k=' + q },
  { key: 'walmart',     name: 'WALMART',     base: 'https://www.walmart.com',       search: (q) => '/search?q=' + q },
  { key: 'best buy',    name: 'BEST BUY',    base: 'https://www.bestbuy.com',       search: (q) => '/site/searchpage.jsp?st=' + q },
  { key: 'bestbuy',     name: 'BEST BUY',    base: 'https://www.bestbuy.com',       search: (q) => '/site/searchpage.jsp?st=' + q },
  { key: 'target',      name: 'TARGET',      base: 'https://www.target.com',        search: (q) => '/s?searchTerm=' + q },
  { key: 'ebay',        name: 'EBAY',        base: 'https://www.ebay.com',          search: (q) => '/sch/i.html?_nkw=' + q },
  { key: 'costco',      name: 'COSTCO',      base: 'https://www.costco.com',        search: (q) => '/CatalogSearch?keyword=' + q },
  { key: 'newegg',      name: 'NEWEGG',      base: 'https://www.newegg.com',        search: (q) => '/p/pl?Description=' + q },
  { key: 'adorama',     name: 'ADORAMA',     base: 'https://www.adorama.com',       search: (q) => '/l/?searchinfo=' + q },
  { key: 'home depot',  name: 'HOME DEPOT',  base: 'https://www.homedepot.com',     search: (q) => '/s/' + q },
  { key: 'lowes',       name: "LOWE'S",      base: 'https://www.lowes.com',         search: (q) => '/search?searchTerm=' + q },
  { key: 'staples',     name: 'STAPLES',     base: 'https://www.staples.com',       search: (q) => '/search#query=' + q },
  { key: 'gamestop',    name: 'GAMESTOP',    base: 'https://www.gamestop.com',      search: (q) => '/search/#q=' + q },
  { key: 'woot',        name: 'WOOT',        base: 'https://www.woot.com',          search: (q) => '/search?q=' + q },
  { key: 'dell',        name: 'DELL',        base: 'https://www.dell.com',          search: (q) => '/search/en-us#q=' + q },
  { key: 'lenovo',      name: 'LENOVO',      base: 'https://www.lenovo.com',        search: (q) => '/us/en/search/?q=' + q },
  { key: 'apple',       name: 'APPLE',       base: 'https://www.apple.com',         search: (q) => '/shop/buy-iphone' },
  { key: 'b&h',         name: 'B&H',         base: 'https://www.bhphotovideo.com',  search: (q) => '/c/search?q=' + q },
]

function extractMerchantFromTitle(title) {
  const t = title.toLowerCase()
  for (const m of MERCHANTS) {
    const k = m.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const patterns = [
      new RegExp('\\bat\\s+' + k + '\\b', 'i'),
      new RegExp('\\bvia\\s+' + k + '\\b', 'i'),
      new RegExp('\\bfrom\\s+' + k + '\\b', 'i'),
      new RegExp('\\(' + k + '\\)', 'i'),
      new RegExp('^' + k + '\\s*:', 'i'),
    ]
    if (patterns.some(re => re.test(t))) return m
  }
  return null
}

function cleanTitleForSearch(title) {
  return encodeURIComponent(
    title
      .replace(/\$[\d,]+\.?\d*/g, '')
      .replace(/\+?\s*free\s+s&h/gi, '')
      .replace(/\+?\s*free\s+shipping/gi, '')
      .replace(/\d+%\s+off/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 80)
  )
}

function buildProductUrl(title, merchant) {
  const q = cleanTitleForSearch(title)
  if (merchant) return buildAffiliateUrl(merchant.base + merchant.search(q))
  return buildAffiliateUrl('https://www.amazon.com/s?k=' + q)
}

function extractPrices(text) {
  return [...text.matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g)]
    .map(m => parseFloat(m[1].replace(/,/g, '')))
    .filter(p => p > 0 && p < 10000)
    .sort((a, b) => b - a)
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim()
}

function extractLink(xml) {
  const m = xml.match(/<link>([^<]+)<\/link>/)
  return m ? m[1].trim() : ''
}

function extractCDATA(tag, xml) {
  const re = new RegExp('<' + tag + '[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/' + tag + '>|<' + tag + '[^>]*>([^<]*)<\\/' + tag + '>', 'i')
  const m = xml.match(re)
  return m ? (m[1] || m[2] || '').trim() : ''
}

function extractImage(html) {
  const m = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
  return m ? m[1] : null
}

function parseItem(itemXml, feedLabel) {
  const title   = extractCDATA('title', itemXml)
  const sdLink  = extractLink(itemXml)
  const desc    = extractCDATA('description', itemXml)
  const encoded = extractCDATA('content:encoded', itemXml)
  const guid    = extractCDATA('guid', itemXml)
  if (!title || !sdLink) return null

  const descText     = stripHtml(encoded || desc)
  const combinedText = title + ' ' + descText
  const prices       = extractPrices(combinedText)
  if (prices.length === 0) return null

  const sale_price     = Math.min(...prices)
  const original_price = prices.length > 1 && Math.max(...prices) > sale_price * 1.05 ? Math.max(...prices) : null
  const discount_pct   = original_price ? Math.round((1 - sale_price / original_price) * 100) : 0
  const image          = extractImage(encoded || desc)
  const merchant       = extractMerchantFromTitle(title)
  const product_url    = buildProductUrl(title, merchant)
  const category       = categorize(title, descText)

  return {
    source_key:          feedLabel,
    external_id:         guid || sdLink,
    merchant:            merchant ? merchant.name : 'AMAZON',
    source_type:         'rss',
    title:               title.slice(0, 255),
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
  const items = [], itemRe = /<item>([\s\S]*?)<\/item>/gi
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
  return all.filter(d => { if (seen.has(d.external_id)) return false; seen.add(d.external_id); return true })
}
