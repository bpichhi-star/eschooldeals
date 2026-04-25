// lib/feeds/rss.js
// Fetches deals from free RSS feeds (Slickdeals, DealNews).
// No API key needed — just RSS parsing.
// Affiliate tags are injected per merchant using env vars.

const WALMART_ID  = process.env.WALMART_AFFILIATE_ID
const AMAZON_TAG  = process.env.AMAZON_ASSOCIATE_TAG || 'eschooldeals-20'

const RSS_FEEDS = [
  {
    url:      'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1',
    source:   'slickdeals',
    label:    'Slickdeals',
  },
  {
    url:      'https://www.dealnews.com/c142/Electronics/?rss=1',
    source:   'dealnews_electronics',
    label:    'DealNews Electronics',
  },
  {
    url:      'https://www.dealnews.com/c196/Computers/?rss=1',
    source:   'dealnews_computers',
    label:    'DealNews Computers',
  },
]

const CATEGORY_MAP = {
  laptop:     'Computers',
  computer:   'Computers',
  monitor:    'Electronics',
  tablet:     'Electronics',
  phone:      'Phones',
  headphone:  'Electronics',
  speaker:    'Electronics',
  tv:         'Electronics',
  television: 'Electronics',
  backpack:   'School',
  charger:    'Electronics',
  usb:        'Electronics',
  keyboard:   'Electronics',
  mouse:      'Electronics',
  camera:     'Electronics',
  kitchen:    'Kitchen',
  appliance:  'Kitchen',
  clothing:   'Fashion',
  shirt:      'Fashion',
  shoe:       'Fashion',
  book:       'Books',
  software:   'Software',
  game:       'Electronics',
}

function detectCategory(text) {
  const lower = text.toLowerCase()
  for (const [keyword, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(keyword)) return cat
  }
  return 'Electronics'
}

function injectAffiliateTag(url) {
  if (!url) return url
  try {
    if (url.includes('walmart.com') && WALMART_ID) {
      const sep = url.includes('?') ? '&' : '?'
      return `${url}${sep}veh=aff&wmlspartner=${WALMART_ID}`
    }
    if (url.includes('amazon.com') && AMAZON_TAG) {
      const sep = url.includes('?') ? '&' : '?'
      return `${url}${sep}tag=${AMAZON_TAG}`
    }
  } catch { /* ignore */ }
  return url
}

function detectMerchant(text, url = '') {
  const combined = (text + ' ' + url).toLowerCase()
  if (combined.includes('walmart'))  return 'WALMART'
  if (combined.includes('amazon'))   return 'AMAZON'
  if (combined.includes('bestbuy') || combined.includes('best buy')) return 'BEST BUY'
  if (combined.includes('target'))   return 'TARGET'
  if (combined.includes('newegg'))   return 'NEWEGG'
  if (combined.includes('costco'))   return 'COSTCO'
  if (combined.includes('bhphoto') || combined.includes('b&h')) return 'B&H'
  if (combined.includes('staples'))  return 'STAPLES'
  return 'OTHER'
}

function extractPrice(text) {
  const match = text.match(/\$[\d,]+\.?\d{0,2}/)
  if (!match) return null
  return parseFloat(match[0].replace(/[$,]/g, ''))
}

function parseRssItems(xml) {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const title       = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                         block.match(/<title>(.*?)<\/title>/))?.[1]?.trim() || ''
    const link        = (block.match(/<link>(.*?)<\/link>/) ||
                         block.match(/<guid>(.*?)<\/guid>/))?.[1]?.trim() || ''
    const description = (block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                         block.match(/<description>(.*?)<\/description>/))?.[1]?.trim() || ''
    const pubDate     = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() || ''

    if (title && link) {
      items.push({ title, link, description, pubDate })
    }
  }
  return items
}

async function fetchRssFeed({ url, source, label }) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ESchoolDeals/1.0)' },
      signal:  AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      console.warn(`[rss:${source}] HTTP ${res.status}`)
      return []
    }

    const xml   = await res.text()
    const items = parseRssItems(xml)

    const deals = items.slice(0, 20).map((item, i) => {
      const fullText   = `${item.title} ${item.description}`
      const salePrice  = extractPrice(item.title) || extractPrice(item.description)
      if (!salePrice || salePrice <= 0) return null

      const merchant   = detectMerchant(fullText, item.link)
      const category   = detectCategory(fullText)
      const productUrl = injectAffiliateTag(item.link)

      return {
        source_key:          source,
        external_id:         `${source}-${Buffer.from(item.link).toString('base64').slice(0, 32)}`,
        merchant,
        source_type:         'rss',
        title:               item.title.slice(0, 255),
        category,
        sale_price:          salePrice,
        original_price:      null,
        discount_pct:        0,
        product_url:         productUrl,
        image_url:           null,
        currency:            'USD',
        in_stock:            true,
        is_student_relevant: ['Computers','Electronics','Books','Software','School'].includes(category),
        is_featured:         false,
      }
    }).filter(Boolean)

    console.log(`[rss:${source}] fetched ${deals.length} deals from ${label}`)
    return deals
  } catch (err) {
    console.error(`[rss:${source}] failed:`, err.message)
    return []
  }
}

export async function fetchRssDeals() {
  const results = await Promise.allSettled(RSS_FEEDS.map(fetchRssFeed))
  return results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
}
