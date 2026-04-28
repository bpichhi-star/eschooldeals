// app/api/debug-feeds/route.js — DELETE after diagnosing RSS issues
// GET /api/debug-feeds?source=slickdeals (or edealinfo or dealnews)
export const runtime = 'nodejs'
export const maxDuration = 30

const SOURCES = {
  slickdeals: { url: 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 'Accept': 'application/rss+xml, application/xml, text/xml, */*' } },
  edealinfo:  { url: 'https://www.edealinfo.com/deals-rss.php', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Referer': 'https://www.google.com/', 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'cross-site' } },
  dealnews:   { url: 'https://dealnews.com/featured/rss.xml',   headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 'Accept': 'application/rss+xml, application/xml, text/xml, */*', 'Referer': 'https://www.google.com/' } },
}

function hrefs(html = '') {
  const decoded = html.replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(parseInt(n)))
  const out = [], re = /href=["']([^"']+)["']/gi; let m
  while ((m = re.exec(decoded)) !== null) out.push(m[1])
  return out
}

function items(xml, n = 3) {
  const out = [], re = /<item>([\s\S]*?)<\/item>/gi; let m
  while ((m = re.exec(xml)) !== null && out.length < n) {
    const x = m[1]
    const title = (x.match(/CDATA\[([\s\S]*?)\]\]><\/title>/) || x.match(/<title[^>]*>([^<]*)<\/title>/))?.[1]?.trim().slice(0,120) || ''
    const link  = (x.match(/<link>([^<]+)<\/link>/))?.[1]?.trim().slice(0,120) || ''
    const desc  = (x.match(/description[^>]*><!\[CDATA\[([\s\S]*?)\]\]/)?.[1] || x.match(/<description[^>]*>([^<]*)<\/description>/)?.[1] || '').slice(0,400)
    out.push({ title, link, descLen: desc.length, desc: desc.replace(/\s+/g,' ').slice(0,250), hrefs: hrefs(desc).slice(0,6) })
  }
  return out
}

export async function GET(req) {
  const src = new URL(req.url).searchParams.get('source') || 'slickdeals'
  const cfg = SOURCES[src]
  if (!cfg) return Response.json({ error: 'use ?source=slickdeals|edealinfo|dealnews' })
  const r = { source: src, url: cfg.url }
  try {
    const res = await fetch(cfg.url, { headers: cfg.headers, cache: 'no-store' })
    r.status = res.status; r.contentType = res.headers.get('content-type')
    const xml = await res.text()
    r.bodyLen = xml.length; r.isXml = xml.includes('<rss') || xml.includes('<?xml') || xml.includes('<feed')
    r.itemCount = (xml.match(/<item>/g)||[]).length
    r.bodyStart = xml.slice(0,200).replace(/\s+/g,' ')
    r.items = items(xml)
  } catch(e) { r.error = e.message }
  return Response.json(r)
}
