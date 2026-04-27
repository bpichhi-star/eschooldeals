// app/api/debug/route.js
// TEMPORARY — fetches raw RSS and returns first item XML for each source
// DELETE after debugging

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.google.com/',
}

async function fetchSample(url, label) {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS })
    const xml = await res.text()
    const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/)
    if (!itemMatch) return { label, status: res.status, error: 'no items found', xmlStart: xml.slice(0, 300) }
    const item = itemMatch[1]
    // Extract key fields
    const hrefs = [...item.matchAll(/href=["']([^"']+)["']/gi)].map(m => m[1]).slice(0, 10)
    const imgs  = [...item.matchAll(/src=["']([^"']+)["']/gi)].map(m => m[1]).slice(0, 5)
    const titleM = item.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title[^>]*>([^<]*)<\/title>/)
    return {
      label,
      status: res.status,
      xmlLength: xml.length,
      title: titleM ? (titleM[1] || titleM[2] || '').slice(0, 100) : 'no title',
      hrefs,
      imgs,
      rawItem: item.slice(0, 1500),
    }
  } catch(e) {
    return { label, error: e.message }
  }
}

export async function GET() {
  const [edi, dn, target] = await Promise.all([
    fetchSample('https://www.edealinfo.com/deals-rss.php', 'edealinfo'),
    fetchSample('https://dealnews.com/featured/rss.xml', 'dealnews'),
    fetchSample('https://serpapi.com/search.json?engine=target&query=laptop&api_key=' + (process.env.SERPAPI_KEY || 'NO_KEY'), 'target'),
  ])
  return Response.json({ edi, dn, target }, { headers: { 'Cache-Control': 'no-store' } })
}
