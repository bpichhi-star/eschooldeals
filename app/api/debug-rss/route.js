export const runtime = 'nodejs'

export async function GET() {
  const feeds = [
    'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1',
    'https://www.edealinfo.com/deals-rss.php',
  ]

  const results = await Promise.all(feeds.map(async url => {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
        cache: 'no-store',
      })
      const text = await res.text()
      
      // Count items and extract first 3 titles + prices
      const itemMatches = text.match(/<item>/g) || []
      const titles = []
      const itemRe = /<item>([sS]*?)<\/item>/gi
      let m, count = 0
      while ((m = itemRe.exec(text)) !== null && count < 3) {
        const block = m[1]
        const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || block.match(/<title>(.*?)<\/title>/))?.[1] || ''
        const priceMatch = title.match(/\$[\d,]+\.?\d*/)
        titles.push({ title: title.slice(0, 80), price: priceMatch?.[0] || 'NO PRICE IN TITLE' })
        count++
      }

      return { url, status: res.status, itemCount: itemMatches.length, sample: titles }
    } catch(e) {
      return { url, error: e.message }
    }
  }))

  return Response.json(results)
}
