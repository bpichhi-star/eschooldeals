// app/api/admin/diagnose/route.js
// Tests each feed exactly as the production code does.
// GET /api/admin/diagnose?feed=slickdeals|walmart|scraperapi|target|all
//
// AUTH: requires Bearer ADMIN_PASSWORD header. Reads sensitive env vars
// (SERPAPI_KEY, SCRAPERAPI_KEY) and probes paid APIs, so cannot be
// anonymous — even on a stale URL.

export const runtime = 'nodejs'
// 60s covers target_pipeline (15 serial RedSky queries × ~2s ≈ 30s
// wall time, with margin for ScraperAPI fallback if RedSky throttles).
// Other endpoints (scraperapi/slickdeals/walmart) finish in <2s.
export const maxDuration = 60

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

// Hits ScraperAPI's account endpoint to report credit/quota status without
// the key ever leaving Vercel runtime. Returns just the metadata fields,
// never echoes the key itself.
async function testScraperApiAccount() {
  const key = process.env.SCRAPERAPI_KEY
  if (!key) return { error: 'SCRAPERAPI_KEY not set' }
  try {
    const res = await fetch('https://api.scraperapi.com/account?api_key=' + key, { cache: 'no-store' })
    const status = res.status
    let data = null, raw = null
    try {
      data = await res.json()
    } catch {
      raw = (await res.text()).slice(0, 200)
    }
    if (!res.ok) {
      return { status, error: data?.error || raw || 'non-OK response' }
    }
    return {
      status,
      // Standard ScraperAPI account fields. Exact keys vary by tier; pass
      // through whatever exists. concurrencyLimit + requestCount + requestLimit
      // are the three we care about most.
      concurrencyLimit:    data.concurrencyLimit    ?? null,
      concurrentRequests:  data.concurrentRequests  ?? null,
      requestCount:        data.requestCount        ?? null,
      requestLimit:        data.requestLimit        ?? null,
      failedRequestCount:  data.failedRequestCount  ?? null,
      // Plan info (some tiers expose this, some don't)
      planName:            data.planName            ?? data.subscriptionDate ?? null,
      // Computed: % of monthly quota consumed
      pctUsed: data.requestCount && data.requestLimit
        ? Math.round((data.requestCount / data.requestLimit) * 100)
        : null,
    }
  } catch(e) {
    return { error: e.message }
  }
}

// End-to-end test of one Target query. Mirrors what the production target.js
// feed does (direct RedSky → ScraperAPI fallback), so we can see exactly
// where the chain breaks. Uses a small fixed query to keep credit cost to 1.
async function testTargetOne() {
  const key = process.env.SCRAPERAPI_KEY
  const REDSKY = 'https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2?key=9f36aeafbe60771e321a7cc95a78140772ab3e96&channel=WEB&keyword=laptop&page=%2Fs%2Flaptop&pricing_store_id=1375&visitor_id=01914BA3F6B30201A8A1A8E62AE6A1B7'
  const out = { redsky: null, scraperapi: null }

  // Step 1: direct RedSky fetch
  try {
    const r = await fetch(REDSKY, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      cache: 'no-store',
    })
    let json = null, snippet = null
    try { json = await r.json() } catch { snippet = '(non-JSON)' }
    const products = json?.data?.search?.products || json?.data?.search?.search_response?.items?.Item || []
    out.redsky = { status: r.status, productCount: Array.isArray(products) ? products.length : 0, snippet }
  } catch(e) {
    out.redsky = { error: e.message }
  }

  // Step 2: ScraperAPI fallback (only if direct didn't 200; skip if no key)
  if (out.redsky?.status !== 200 && key) {
    try {
      const proxyUrl = 'https://api.scraperapi.com/?api_key=' + key + '&url=' + encodeURIComponent(REDSKY) + '&keep_headers=true'
      const r = await fetch(proxyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        cache: 'no-store',
      })
      let json = null, snippet = null
      try { json = await r.json() } catch { snippet = (await r.text()).slice(0, 200) }
      const products = json?.data?.search?.products || []
      out.scraperapi = { status: r.status, productCount: Array.isArray(products) ? products.length : 0, snippet }
    } catch(e) {
      out.scraperapi = { error: e.message }
    }
  } else if (out.redsky?.status === 200) {
    out.scraperapi = { skipped: 'direct RedSky succeeded — no fallback needed' }
  } else {
    out.scraperapi = { error: 'SCRAPERAPI_KEY not set' }
  }

  return out
}

// Runs the REAL production fetchTargetDeals() — exercises the full
// 15-query serialized path. If the production code is healthy this
// returns a non-zero deal count and timing, with credits used = 0
// (direct RedSky) or some small number (ScraperAPI fallback used).
//
// Replaces an earlier bespoke URL-builder diagnostic that had the
// same double-encoding bug we fixed in production target.js (commit
// 57e7f60), making it a misleading test — it kept reporting 400 even
// after the production fix landed.
async function testTargetPipeline() {
  const start = Date.now()
  try {
    const { fetchTargetDeals } = await import('@/lib/feeds/target')
    const deals = await fetchTargetDeals()
    return {
      elapsedMs: Date.now() - start,
      dealCount: Array.isArray(deals) ? deals.length : 0,
      sample: Array.isArray(deals) && deals.slice(0, 3).map(d => ({
        title:       (d.title || '').slice(0, 80),
        category:    d.category,
        salePrice:   d.sale_price,
        discountPct: d.discount_pct,
      })),
    }
  } catch(e) {
    return { elapsedMs: Date.now() - start, error: e.message }
  }
}
function isAdmin(req) {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return false
  const header = req.headers.get('authorization') || ''
  return header === 'Bearer ' + adminPassword
}

export async function GET(req) {
  if (!isAdmin(req)) {
    return Response.json({ error: 'Unauthorized — pass ADMIN_PASSWORD as Bearer token' }, { status: 401 })
  }
  const feed = new URL(req.url).searchParams.get('feed') || 'all'
  const results = {}
  if (feed === 'slickdeals'        || feed === 'all') results.slickdeals = await testSlickdeals()
  if (feed === 'walmart'           || feed === 'all') results.walmart    = await testSerpApi('walmart', 'student laptop')
  if (feed === 'scraperapi'        || feed === 'all') results.scraperapi = await testScraperApiAccount()
  if (feed === 'target'            || feed === 'all') results.target     = await testTargetOne()
  if (feed === 'target_pipeline')                     results.target_pipeline = await testTargetPipeline()
  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } })
}
