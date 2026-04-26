// lib/feeds/slickdeals.js
import { categorize } from '@/lib/utils/categorize'
import { buildAffiliateUrl } from '@/lib/utils/affiliateUrl'

const FEEDS = [
  { url: 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1', label: 'slickdeals-frontpage' },
  { url: 'https://slickdeals.net/newsearch.php?mode=popdeals&searcharea=deals&searchin=first&rss=1',  label: 'slickdeals-popular'  },
  { url: 'https://slickdeals.net/newsearch.php?mode=topdeals&searcharea=deals&searchin=first&rss=1',  label: 'slickdeals-top'      },
]

// Extract ALL dollar amounts from text — returns array sorted descending
function extractPrices(text = '') {
  const matches = [...text.matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g)]
  return matches
    .map(m => parseFloat(m[1].replace(/,/g, '')))
    .filter(p => p > 0 && p < 10000)
    .sort((a, b) => b - a)
}

function stripHtml(html = '') {
  return html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim()
}

function extractLink(itemXml = '') {
  // Try link tag first, then guid
  const linkM = itemXml.match(/<link>([^<]+)<\/link>/)
  if (linkM) return linkM[1].trim()
  const guidM = itemXml.match(/<guid[^>]*>([^<]+)<\/guid>/)
  return guidM ? guidM[1].trim() : ''
}

function extractCDATA(tag, xml) {
  const re = new RegExp('<' + tag + '[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/' + tag + '>|<' + tag + '[^>]*>([^<]*)<\/' + tag + '>', 'i')
  const m = xml.match(re)
  return m ? (m[1] || m[2] || '').trim() : ''
}

function extractImage(html = '') {
  const m = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
  return m ? m[1] : null
}

function parseItem(itemXml, feedLabel) {
  const title    = extractCDATA('title', itemXml)
  const link     = extractLink(itemXml)
  const desc     = stripHtml(extractCDATA('description', itemXml))
  const encoded  = extractCDATA('content:encoded', itemXml)
  const guid     = extractCDATA('guid', itemXml)

  if (!title || !link) return null

  const combinedText = title + ' ' + desc
  const prices = extractPrices(combinedText)

  // Need at least one price
  if (prices.length === 0) return null

  // Sale price = lowest price found, original = highest if different
  const sale_price     = Math.min(...prices)
  const original_price = prices.length > 1 && Math.max(...prices) > sale_price * 1.05
    ? Math.max(...prices)
    : null
  const discount_pct = original_price
    ? Math.round((1 - sale_price / original_price) * 100)
    : 0

  const image       = extractImage(encoded || '')
  const category    = categorize(title, desc)
  const product_url = buildAffiliateUrl(link)

  // Score: discount + image bonus + deal quality signals
  const score = Math.min(discount_pct, 50) + (image ? 10 : 0) +
    (/free shipping|free s&h/i.test(combinedText) ? 5 : 0)

  return {
    source_key: feedLabel, external_id: guid || link, merchant: 'SLICKDEALS',
    source_type: 'rss', title: title.slice(0, 255), category,
    sale_price, original_price, discount_pct,
    product_url, image_url: image || null,
    currency: 'USD', in_stock: true,
    is_student_relevant: ['Electronics','Computers','Phones'].includes(category) && (discount_pct >= 15 || sale_price < 100),
    is_featured: false, score,
    fetched_at: new Date().toISOString(), status: 'active',
  }
}

function parseFeed(xml, feedLabel) {
  const items = []
  const itemRe = /<item>([\s\S]*?)<\/item>/gi
  let m
  while ((m = itemRe.exec(xml)) !== null) {
    try { const d = parseItem(m[1], feedLabel); if (d) items.push(d) }
    catch (e) { console.warn('[slickdeals] parse error:', e.message) }
  }
  return items
}

export async function fetchSlickdealsDeals() {
  console.log('[slickdeals] Fetching', FEEDS.length, 'feeds')
  const results = await Promise.allSettled(
    FEEDS.map(async ({ url, label }) => {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
        next: { revalidate: 0 },
      })
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + label)
      const xml = await res.text()
      const deals = parseFeed(xml, label)
      console.log('[slickdeals] ' + label + ': ' + deals.length + ' deals')
      return deals
    })
  )
  const all  = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value)
  const seen = new Set()
  return all.filter(d => {
    if (seen.has(d.external_id)) return false
    seen.add(d.external_id)
    return true
  })
}
