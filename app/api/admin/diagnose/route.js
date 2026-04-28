// app/api/admin/diagnose/route.js
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req) {
  const feed = new URL(req.url).searchParams.get('feed') || 'edealinfo'
  const results = {}

  if (feed === 'edealinfo' || feed === 'all') {
    // Test rss2json proxy approach
    try {
      const proxyUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent('https://www.edealinfo.com/deals-rss.php')
      const res  = await fetch(proxyUrl)
      const data = await res.json()
      const items = data.items || []
      const first = items[0] || null
      results.edealinfo_via_rss2json = {
        status:     res.status,
        rss2status: data.status,
        message:    data.message || null,
        itemCount:  items.length,
        firstItem:  first ? {
          title:       (first.title || '').slice(0, 100),
          link:        (first.link || '').slice(0, 100),
          thumbnail:   first.thumbnail || null,
          description: (first.description || '').slice(0, 300),
          hasDollar:   /\$[\d,]+/.test(first.title || ''),
          hrefs:       [...(first.description || '').matchAll(/href=["']([^"']+)["']/gi)].map(m => m[1]).slice(0, 5),
        } : null,
      }
    } catch(e) {
      results.edealinfo_via_rss2json = { error: e.message }
    }
  }

  if (feed === 'slickdeals' || feed === 'all') {
    try {
      const res = await fetch('https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
      })
      const xml = await res.text()
      const titleM = xml.match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/i)
      const descM  = xml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)
      const desc = descM?.[1] || ''
      results.slickdeals = {
        status: res.status, itemCount: (xml.match(/<item>/gi)||[]).length,
        firstTitle: titleM?.[1]?.slice(0,100),
        descLength: desc.length,
        hrefs: [...desc.matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1]).slice(0,5),
        hasDollar: /\$[\d,]+/.test(titleM?.[1]||''),
      }
    } catch(e) { results.slickdeals = { error: e.message } }
  }

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } })
}
