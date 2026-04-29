// app/api/debug/slickdeals-raw/route.js
// One-off debug endpoint — returns the first <item> from the Slickdeals RSS
// feed verbatim so we can see what fields & href patterns are actually present.
// Delete after diagnosing.

export const runtime = 'nodejs'

export async function GET() {
  const url = 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1'
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':     'application/rss+xml, application/xml, text/xml, */*',
      },
    })
    if (!res.ok) {
      return Response.json({ ok: false, status: res.status, error: 'fetch failed' })
    }
    const xml = await res.text()
    const itemM = xml.match(/<item>([\s\S]*?)<\/item>/i)
    if (!itemM) {
      return Response.json({ ok: false, length: xml.length, sample: xml.slice(0, 800) })
    }
    const item = itemM[1]

    // Pull out each child tag separately so we can see them clearly
    const tags = ['title', 'link', 'description', 'content:encoded', 'guid', 'pubDate', 'category']
    const fields = {}
    for (const t of tags) {
      const re = new RegExp('<' + t + '[^>]*>([\\s\\S]*?)<\\/' + t + '>', 'i')
      const m = item.match(re)
      fields[t] = m ? m[1].slice(0, 3000) : null
    }

    // Also show every distinct href found in the whole item
    const hrefs = []
    const hrefRe = /href=["']([^"']+)["']/gi
    let h
    while ((h = hrefRe.exec(item)) !== null) hrefs.push(h[1])

    return Response.json({
      ok: true,
      length: xml.length,
      itemPreview: item.slice(0, 500),
      fields,
      hrefs: [...new Set(hrefs)].slice(0, 20),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return Response.json({ ok: false, error: e.message })
  }
}
