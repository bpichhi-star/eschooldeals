// lib/feeds/target.js
// Pulls deals from Target via SerpApi (engine: 'target').
// Queries are deliberately narrow — student-relevant products with price context.
// Each query costs 1 SerpApi credit. Keep total queries lean.

const SERPAPI_KEY   = process.env.SERPAPI_KEY
const AFFILIATE_TAG = process.env.TARGET_AFFILIATE_ID  // e.g. your Impact/Target affiliate ID

// ─── Curated query list ────────────────────────────────────────────────────────
// Rules:
//   - Every query targets a SPECIFIC product type (not a broad category)
//   - Include a price signal ("under $X", "clearance", "sale") where possible
//   - student_relevant = true only for things a college/HS student actually needs
//   - max_price enforced client-side to filter out expensive results SerpApi returns
const QUERIES = [
  // Tech essentials
  { q: 'laptop under 500',                  category: 'Computers',    max_price: 520,  student: true  },
  { q: 'chromebook student',                category: 'Computers',    max_price: 400,  student: true  },
  { q: 'wireless earbuds under 70',         category: 'Electronics',  max_price: 75,   student: true  },
  { q: 'bluetooth headphones under 80',     category: 'Electronics',  max_price: 90,   student: true  },
  { q: 'USB-C hub multiport adapter',       category: 'Accessories',  max_price: 60,   student: true  },
  { q: 'portable charger power bank',       category: 'Accessories',  max_price: 50,   student: true  },
  { q: 'laptop backpack under 40',          category: 'Accessories',  max_price: 50,   student: true  },
  // Dorm / apartment
  { q: 'mini fridge dorm clearance',        category: 'Home',         max_price: 200,  student: true  },
  { q: 'desk lamp LED clearance',           category: 'Home',         max_price: 40,   student: true  },
  { q: 'bedding twin XL college',           category: 'Home',         max_price: 80,   student: true  },
  { q: 'storage bins organizer sale',       category: 'Home',         max_price: 30,   student: false },
  // School supplies
  { q: 'notebook journal planner sale',     category: 'General',      max_price: 20,   student: true  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildAffiliateUrl(url) {
  if (!url) return url
  try {
    const u = new URL(url)
    if (AFFILIATE_TAG) u.searchParams.set('afid', AFFILIATE_TAG)
    return u.toString()
  } catch { return url }
}

function calcDiscountPct(sale, original) {
  if (!original || original <= sale) return 0
  return Math.round(((original - sale) / original) * 100)
}

// Extract best original/was price from however SerpApi returns it
function parseOriginal(item) {
  const candidates = [
    item.was_price,
    item.original_price,
    item.list_price,
    item.primary_offer?.was_price,
    item.primary_offer?.list_price,
    item.primary_offer?.original_price,
    item.price?.was,
    item.price?.original,
  ]
  for (const c of candidates) {
    const n = parseFloat(c)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

async function searchTarget({ q, category, max_price, student }) {
  if (!SERPAPI_KEY) return []

  const params = new URLSearchParams({
    engine:  'target',
    query:   q,
    api_key: SERPAPI_KEY,
  })

  let res
  try {
    res = await fetch('https://serpapi.com/search.json?' + params.toString())
  } catch (e) {
    console.error('[target] fetch error for "' + q + '":', e.message)
    return []
  }

  if (!res.ok) {
    console.error('[target] SerpApi ' + res.status + ' for "' + q + '"')
    return []
  }

  const data = await res.json()
  const items = data.search_results || data.organic_results || data.results || []

  return items
    .filter(item => {
      const price = parseFloat(item.price?.current || item.current_price || item.price || 0)
      if (!price || price <= 0) return false
      if (price > max_price) return false                       // enforce our price ceiling
      if (!item.image || !item.link) return false               // must have image + URL
      return true
    })
    .slice(0, 8)  // max 8 results per query — keeps volume controlled
    .map(item => {
      const sale_price     = parseFloat(item.price?.current || item.current_price || item.price || 0)
      const original_price = (() => {
        const o = parseOriginal(item)
        return o && o > sale_price ? o : null
      })()
      const discount_pct = calcDiscountPct(sale_price, original_price)

      // Build a clean Target product URL — strip tracking params, add our affiliate tag
      const rawUrl = item.link || item.product_page_url || ''
      const product_url = buildAffiliateUrl(rawUrl)

      // Skip if no usable URL
      if (!product_url) return null

      return {
        source_key:          'target',
        external_id:         String(item.tcin || item.product_id || rawUrl),
        merchant:            'TARGET',
        source_type:         'serp',
        title:               (item.title || '').slice(0, 255),
        category,
        sale_price,
        original_price,
        discount_pct,
        product_url,
        image_url:           item.image || item.thumbnail || null,
        currency:            'USD',
        in_stock:            item.in_stock !== false,
        is_student_relevant: student && (discount_pct >= 10 || sale_price < 50),
        is_featured:         false,
        score:
          Math.min(discount_pct, 50) +
          (item.image ? 8 : 0) +
          (student ? 5 : 0),
        fetched_at: new Date().toISOString(),
        status:     'active',
      }
    })
    .filter(Boolean)
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function fetchTargetDeals() {
  if (!SERPAPI_KEY) {
    console.warn('[target] SERPAPI_KEY not set — skipping')
    return []
  }

  console.log('[target] Fetching', QUERIES.length, 'queries')

  const results = await Promise.allSettled(QUERIES.map(q => searchTarget(q)))

  // Log failures per query
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error('[target] "' + QUERIES[i].q + '" failed:', r.reason?.message)
    else console.log('[target] "' + QUERIES[i].q + '": ' + r.value.length + ' results')
  })

  const deals = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value)

  // Deduplicate by external_id
  const seen   = new Set()
  const unique = deals.filter(d => {
    if (!d?.external_id || seen.has(d.external_id)) return false
    seen.add(d.external_id)
    return true
  })

  console.log('[target] ' + unique.length + ' unique deals from ' + deals.length + ' total')
  return unique
}
