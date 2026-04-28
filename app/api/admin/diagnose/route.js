// app/api/admin/diagnose/route.js
// Diagnostic endpoint — tests each RSS feed individually and returns what's happening.
// GET /api/admin/diagnose?feed=slickdeals|edealinfo|dealnews|walmart|target
// DELETE THIS FILE after debugging.

export const runtime = 'nodejs'
export const maxDuration = 30

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.google.com/',
  'Cache-Control': 'no-cache',
}

function extractFirstItem(xml) {
  const m = xml.match(/<item>([\s\S]*?)<\/item>/i)
  if (!m) return null
  const item = m[1]
  
  // Get title
  const titleM = item.match(/<!\[CDATA\[([\s\S]*?)\]\]>/) || item.match(/<title[^>]*>([^<]*)<\/title>/)
  const title = titleM?.[1]?.trim() || ''
  
  // Get link
  const linkM = item.match(/<link>([^<]+)<\/link>/)
  const link = linkM?.[1]?.trim() || ''
  
  // Get all hrefs from description
  const descM = item.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)
  const desc = descM?.[1] || ''
  const hrefs = [...desc.matchAll(/href=["']([^"']+)["']/gi)].map(m => m[1]).slice(0, 5)
  
  // Check for price
  const hasDollar = /\$\s*[\d,]+\.?\d*/.test(title + ' ' + desc)
  
  // Check for ASIN
  const asinM = (desc + ' ' + link).match(/(?:amazon\.com\/dp\/|asin=)([A-Z0-9]{10})/i)
  
  return { title: title.slice(0, 100), link: link.slice(0, 100), hrefs, hasDollar, asin: asinM?.[1] || null, descLength: desc.length }
}

async function testRss(url) {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS })
    const text = await res.text()
    const isXml = text.trim().startsWith('<?xml') || text.includes('<rss') || text.includes('<feed')
    const itemCount = (text.match(/<item>/gi) || []).length
    const firstItem = isXml ? extractFirstItem(text) : null
    return {
      status: res.status,
      ok: res.ok,
      isXml,
      itemCount,
      responseLength: text.length,
      responseStart: text.slice(0, 200),
      firstItem,
    }
  } catch(e) {
    return { error: e.message }
  }
}

async function testSerpApi(engine, query) {
  const key = process.env.SERPAPI_KEY
  if (!key) return { error: 'SERPAPI_KEY not set' }
  try {
    const params = new URLSearchParams({ engine, query, api_key: key })
    const res = await fetch('https://serpapi.com/search.json?' + params)
    const data = await res.json()
    const items = data.organic_results || data.search_results || data.results || []
    const firstItem = items[0] || null
    return {
      status: res.status,
      ok: res.ok,
      resultCount: items.length,
      error: data.error || null,
      firstItemKeys: firstItem ? Object.keys(firstItem) : [],
      firstItemPrice: firstItem ? (firstItem.price || firstItem.primary_offer?.offer_price || firstItem.current_price || 'NOT FOUND') : null,
      firstItemUrl: firstItem ? (firstItem.product_page_url || firstItem.link || firstItem.url || 'NOT FOUND') : null,
    }
  } catch(e) {
    return { error: e.message }
  }
}

export async function GET(req) {
  const feed = new URL(req.url).searchParams.get('feed') || 'all'
  const results = {}

  if (feed === 'slickdeals' || feed === 'all') {
    results.slickdeals = await testRss('https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1')
  }
  if (feed === 'edealinfo' || feed === 'all') {
    results.edealinfo = await testRss('https://www.edealinfo.com/deals-rss.php')
  }
  if (feed === 'dealnews' || feed === 'all') {
    results.dealnews = await testRss('https://dealnews.com/featured/rss.xml')
  }
  if (feed === 'walmart' || feed === 'all') {
    results.walmart = await testSerpApi('walmart', 'student laptop under 400')
  }
  if (feed === 'target' || feed === 'all') {
    results.target = await testSerpApi('target', 'wireless earbuds under 70')
  }

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } })
}
