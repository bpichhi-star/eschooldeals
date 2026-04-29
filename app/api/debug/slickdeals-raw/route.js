// app/api/debug/slickdeals-raw/route.js
// One-off debug — fetches the Slickdeals RSS from Vercel runtime and writes
// the first item's fields + every href found into the debug_samples table
// in Supabase so we can inspect via SQL. Delete after diagnosing.

import { getSupabaseAdmin } from '@/lib/db/supabaseAdmin'
export const runtime = 'nodejs'

export async function GET() {
  const url = 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1'
  const supabase = getSupabaseAdmin()
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':     'application/rss+xml, application/xml, text/xml, */*',
      },
    })
    const xml = res.ok ? await res.text() : ''
    const itemM = xml.match(/<item>([\s\S]*?)<\/item>/i)
    const item = itemM ? itemM[1] : ''

    const tags = ['title', 'link', 'description', 'content:encoded', 'guid', 'pubDate']
    const fields = {}
    for (const t of tags) {
      const re = new RegExp('<' + t + '[^>]*>([\\s\\S]*?)<\\/' + t + '>', 'i')
      const m  = item.match(re)
      fields[t] = m ? m[1].slice(0, 4000) : null
    }
    const hrefs = []
    let h, hrefRe = /href=["']([^"']+)["']/gi
    while ((h = hrefRe.exec(item)) !== null) hrefs.push(h[1])

    const payload = JSON.stringify({
      status: res.status,
      length: xml.length,
      itemPreview: item.slice(0, 800),
      fields,
      hrefs: [...new Set(hrefs)].slice(0, 30),
    })

    await supabase.from('debug_samples').insert({ key: 'slickdeals-rss', payload })
    return Response.json({ ok: true, length: payload.length })
  } catch (e) {
    await supabase.from('debug_samples').insert({ key: 'slickdeals-rss-error', payload: String(e?.message || e) })
    return Response.json({ ok: false, error: e.message })
  }
}
