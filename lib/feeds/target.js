// lib/feeds/target.js
const SERPAPI_KEY   = process.env.SERPAPI_KEY
const AFFILIATE_TAG = process.env.TARGET_AFFILIATE_ID

const QUERIES = [
  { q: 'student laptop under 400 clearance',    category: 'Computers',   max_price: 420,  student: true  },
  { q: 'Chromebook 11 inch',                    category: 'Computers',   max_price: 350,  student: true  },
  { q: 'wireless earbuds under 70',             category: 'Electronics', max_price: 75,   student: true  },
  { q: 'bluetooth headphones under 80',         category: 'Electronics', max_price: 90,   student: true  },
  { q: 'USB-C hub multiport adapter',           category: 'Accessories', max_price: 60,   student: true  },
  { q: 'portable charger power bank',           category: 'Accessories', max_price: 50,   student: true  },
  { q: 'laptop backpack under 40',              category: 'Accessories', max_price: 50,   student: true  },
  { q: 'mini fridge dorm clearance',            category: 'Home',        max_price: 200,  student: true  },
  { q: 'desk lamp LED clearance',               category: 'Home',        max_price: 40,   student: true  },
  { q: 'bedding twin XL college',               category: 'Home',        max_price: 80,   student: true  },
  { q: 'storage bins organizer sale',           category: 'Home',        max_price: 30,   student: false },
  { q: 'notebook journal planner sale',         category: 'General',     max_price: 20,   student: true  },
  { q: 'portable SSD external drive under 80',  category: 'Electronics', max_price: 85,   student: true  },
  { q: 'webcam 1080p under 50',                 category: 'Electronics', max_price: 55,   student: true  },
  { q: 'laptop stand adjustable under 30',      category: 'Accessories', max_price: 35,   student: true  },
  { q: 'surge protector power strip dorm',      category: 'Accessories', max_price: 28,   student: true  },
  { q: 'noise cancelling headphones under 100', category: 'Electronics', max_price: 110,  student: true  },
  { q: 'Keurig coffee maker under 60',          category: 'Home',        max_price: 65,   student: true  },
  { q: 'shower caddy dorm bathroom',            category: 'Home',        max_price: 22,   student: true  },
  { q: 'collapsible laundry hamper',            category: 'Home',        max_price: 22,   student: false },
  { q: 'college hoodie sweatshirt under 40',    category: 'Fashion',     max_price: 45,   student: true  },
  { q: 'running shoes under 60',               category: 'Fashion',     max_price: 65,   student: true  },
]

function buildAffiliateUrl(url) {
  if (!url) return url
  try { const u = new URL(url); if (AFFILIATE_TAG) u.searchParams.set('afid', AFFILIATE_TAG); return u.toString() }
  catch { return url }
}

// FIX: SerpApi returns prices as strings like "$29.99" — strip non-numeric chars before parseFloat
function parsePriceStr(val) {
  if (val == null) return null
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

function calcDiscountPct(sale, original) {
  if (!original || original <= sale) return 0
  return Math.round(((original - sale) / original) * 100)
}

function parseOriginal(item) {
  for (const c of [item.was_price, item.original_price, item.list_price, item.price?.was, item.price?.original, item.primary_offer?.was_price, item.primary_offer?.list_price]) {
    const n = parsePriceStr(c)
    if (n) return n
  }
  return null
}

async function searchTarget({ q, category, max_price, student }) {
  if (!SERPAPI_KEY) return []
  const params = new URLSearchParams({ engine: 'target', query: q, api_key: SERPAPI_KEY })
  let res
  try { res = await fetch('https://serpapi.com/search.json?' + params.toString()) }
  catch (e) { console.error('[target] fetch error for "' + q + '":', e.message); return [] }
  if (!res.ok) { console.error('[target] SerpApi ' + res.status + ' for "' + q + '"'); return [] }

  const data  = await res.json()
  const items = data.search_results || data.organic_results || data.results || []

  return items.map(item => {
    // FIX: try all price field locations, handle "$X.XX" string format
    const sale_price = parsePriceStr(item.price?.current)
                    ?? parsePriceStr(item.current_price)
                    ?? parsePriceStr(item.price)
                    ?? parsePriceStr(item.offer_price)
    if (!sale_price || sale_price <= 0 || sale_price > max_price) return null
    if (!item.image && !item.thumbnail) return null
    const rawUrl = item.link || item.product_page_url || item.url || ''
    if (!rawUrl) return null
    const original_price = (() => { const o = parseOriginal(item); return o && o > sale_price ? o : null })()
    const discount_pct = calcDiscountPct(sale_price, original_price)
    return {
      source_key: 'target', external_id: String(item.tcin || item.product_id || rawUrl),
      merchant: 'TARGET', source_type: 'serp',
      title: (item.title || '').slice(0, 255), category, sale_price, original_price, discount_pct,
      product_url: buildAffiliateUrl(rawUrl), image_url: item.image || item.thumbnail || null,
      currency: 'USD', in_stock: item.in_stock !== false,
      is_student_relevant: student && (discount_pct >= 10 || sale_price < 50),
      is_featured: false,
      score: Math.min(discount_pct, 50) + (item.image || item.thumbnail ? 8 : 0) + (student ? 5 : 0),
      fetched_at: new Date().toISOString(), status: 'active',
    }
  }).filter(Boolean).slice(0, 8)
}

export async function fetchTargetDeals() {
  if (!SERPAPI_KEY) { console.warn('[target] SERPAPI_KEY not set — skipping'); return [] }
  console.log('[target] Fetching', QUERIES.length, 'queries')
  const results = await Promise.allSettled(QUERIES.map(q => searchTarget(q)))
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error('[target] "' + QUERIES[i].q + '" failed:', r.reason?.message)
    else console.log('[target] "' + QUERIES[i].q + '": ' + r.value.length + ' results')
  })
  const deals = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value)
  const seen = new Set()
  const unique = deals.filter(d => { if (!d?.external_id || seen.has(d.external_id)) return false; seen.add(d.external_id); return true })
  console.log('[target] ' + unique.length + ' unique deals')
  return unique
}
