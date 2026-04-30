// app/api/admin/diagnose/route.js
// Tests each feed exactly as the production code does.
// GET /api/admin/diagnose?feed=slickdeals|dealnews|walmart|target|all

export const runtime = 'nodejs'
export const maxDuration = 30

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.google.com/',
}

// Test Slickdeals RSS directly
async function testSlickdeals() {
  const url = 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1'
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS })
    const text = await res.text()
    const itemRe = /<item>([\s\S]*?)<\/item>/gi
    let m, count = 0, firstTitle = '', firstHrefs = []
    while ((m = itemRe.exec(text)) !== null && count < 1) {
      count++
      const titleM = m[1].match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
      firstTitle = (titleM?.[1] || '').slice(0, 100)
      // Does title contain merchant name?
      firstHrefs = [...m[1].matchAll(/href=["']([^"']+)["']/gi)].map(x => x[1]).slice(0, 5)
    }
    const totalItems = (text.match(/<item>/gi) || []).length
    return {
      status: res.status,
      isXml: text.includes('<?xml') || text.includes('<rss'),
      totalItems,
      firstTitle,
      firstHrefs,
      hasMerchantInTitle: /\bat\s+(amazon|walmart|best buy|target|ebay|costco|newegg)/i.test(firstTitle),
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
    const items = data.organic_results || data.search_results || []
    const first = items[0]
    return {
      status: res.status,
      resultCount: items.length,
      error: data.error || null,
      firstItemKeys: first ? Object.keys(first) : [],
      firstItemPrice: first ? (first.primary_offer?.offer_price ?? first.price ?? 'NOT FOUND') : null,
      firstItemUrl: first ? (first.product_page_url || first.link || 'NOT FOUND') : null,
    }
  } catch(e) {
    return { error: e.message }
  }
}

export async function GET(req) {
  const feed = new URL(req.url).searchParams.get('feed') || 'all'
  const results = {}
  if (feed === 'slickdeals' || feed === 'all') results.slickdeals = await testSlickdeals()
  if (feed === 'walmart'    || feed === 'all') results.walmart    = await testSerpApi('walmart', 'student laptop')
  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } })
}
