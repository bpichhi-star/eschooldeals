// lib/feeds/walmart.js
// Pulls deals from Walmart via SerpApi (engine: 'walmart').
// Queries are deliberately narrow — specific product types with price ceilings.
// Each query = 1 SerpApi credit.

const SERPAPI_KEY   = process.env.SERPAPI_KEY
const AFFILIATE_TAG = process.env.WALMART_AFFILIATE_ID

// ─── Curated query list ────────────────────────────────────────────────────────
// Rules:
//   - Specific product type + price signal in every query
//   - max_price enforced client-side to filter noise SerpApi returns
//   - student = true only for things a college/HS student genuinely needs
const QUERIES = [
  // Tech — specific models/types, not just "laptop"
  { q: 'student laptop under 400 clearance',     category: 'Computers',   max_price: 420,  student: true  },
  { q: 'Chromebook 11 inch',                     category: 'Computers',   max_price: 350,  student: true  },
  { q: 'wireless earbuds under 70',              category: 'Electronics', max_price: 75,   student: true  },
  { q: 'over ear headphones under 50',           category: 'Electronics', max_price: 55,   student: true  },
  { q: 'USB-C charging hub adapter',             category: 'Accessories', max_price: 40,   student: true  },
  { q: '10000mAh portable charger power bank',   category: 'Accessories', max_price: 35,   student: true  },
  { q: 'laptop sleeve 15 inch',                  category: 'Accessories', max_price: 25,   student: true  },
  // Dorm
  { q: 'twin XL mattress topper dorm',           category: 'Home',        max_price: 60,   student: true  },
  { q: 'desk lamp with USB port',                category: 'Home',        max_price: 30,   student: true  },
  { q: 'under desk drawer organizer',            category: 'Home',        max_price: 25,   student: false },
  // School supplies
  { q: 'composition notebook 10 pack',           category: 'General',     max_price: 20,   student: true  },,
  // More tech
  { q: 'portable SSD external drive under 80',   category: 'Electronics', max_price: 85,   student: true  },
  { q: 'webcam 1080p HD under 50',               category: 'Electronics', max_price: 55,   student: true  },
  { q: 'adjustable laptop stand under 30',        category: 'Accessories', max_price: 35,   student: true  },
  { q: 'surge protector 6 outlet dorm',           category: 'Accessories', max_price: 28,   student: true  },
  { q: 'noise cancelling headphones under 100',   category: 'Electronics', max_price: 110,  student: true  },
  // Dorm lifestyle
  { q: 'Keurig mini coffee maker clearance',      category: 'Home',        max_price: 65,   student: true  },
  { q: 'shower caddy organizer dorm',             category: 'Home',        max_price: 22,   student: true  },
  { q: 'collapsible laundry hamper',              category: 'Home',        max_price: 22,   student: false },
  // Fashion
  { q: 'pullover hoodie sweatshirt under 40',     category: 'Fashion',     max_price: 45,   student: true  },
  { q: 'running shoes men women under 60',        category: 'Fashion',     max_price: 65,   student: true  }
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildAffiliateUrl(url) {
  if (!AFFILIATE_TAG) return url
  const sep = url.includes('?') ? '&' : '?'
  return url + sep + 'veh=aff&wmlspartner=' + AFFILIATE_TAG
}

function calcDiscountPct(sale, original) {
  if (!original || original <= sale) return 0
  return Math.round(((original - sale) / original) * 100)
}

function parseOriginal(item) {
  const candidates = [
    item.was_price,
    item.primary_offer?.was_price,
    item.primary_offer?.list_price,
    item.primary_offer?.original_price,
    item.price_was,
    item.list_price,
  ]
  for (const c of candidates) {
    const n = parseFloat(c)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

async function searchWalmart({ q, category, max_price, student }) {
  const params = new URLSearchParams({
    engine:  'walmart',
    query:   q,
    api_key: SERPAPI_KEY,
    sort_by: 'best_seller',
  })

  let res
  try {
    res = await fetch('https://serpapi.com/search.json?' + params.toString())
  } catch (e) {
    console.error('[walmart] fetch error for "' + q + '":', e.message)
    return []
  }

  if (!res.ok) {
    console.error('[walmart] SerpApi ' + res.status + ' for "' + q + '"')
    return []
  }

  const data = await res.json()
  const items = data.organic_results || []

  return items
    .filter(item => {
      const price = parseFloat(item.primary_offer?.offer_price || 0)
      if (!price || price <= 0) return false
      if (price > max_price) return false        // enforce price ceiling
      if (!item.thumbnail || !item.product_page_url) return false
      return true
    })
    .slice(0, 8)  // max 8 per query
    .map(item => {
      const sale_price     = parseFloat(item.primary_offer?.offer_price)
      const original_price = (() => {
        const o = parseOriginal(item)
        return o && o > sale_price ? o : null
      })()
      const discount_pct = calcDiscountPct(sale_price, original_price)

      if (!sale_price || sale_price <= 0) return null

      return {
        source_key:          'walmart',
        external_id:         String(item.us_item_id || item.product_id),
        merchant:            'WALMART',
        source_type:         'serp',
        title:               (item.title || '').slice(0, 255),
        category,
        sale_price,
        original_price,
        discount_pct,
        product_url:         buildAffiliateUrl(item.product_page_url),
        image_url:           item.thumbnail || null,
        currency:            'USD',
        in_stock:            true,
        is_student_relevant: student && (discount_pct >= 10 || sale_price < 50),
        is_featured:         false,
        score:
          Math.min(discount_pct, 50) +
          (item.thumbnail ? 8 : 0) +
          (student ? 5 : 0),
        fetched_at: new Date().toISOString(),
        status:     'active',
      }
    })
    .filter(Boolean)
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function fetchWalmartDeals() {
  if (!SERPAPI_KEY) {
    console.warn('[walmart] SERPAPI_KEY not set — skipping')
    return []
  }

  console.log('[walmart] Fetching', QUERIES.length, 'queries')

  const results = await Promise.allSettled(QUERIES.map(q => searchWalmart(q)))

  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error('[walmart] "' + QUERIES[i].q + '" failed:', r.reason?.message)
    else console.log('[walmart] "' + QUERIES[i].q + '": ' + r.value.length + ' results')
  })

  const deals = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value)

  const seen   = new Set()
  const unique = deals.filter(d => {
    if (!d?.external_id || seen.has(d.external_id)) return false
    seen.add(d.external_id)
    return true
  })

  console.log('[walmart] ' + unique.length + ' unique deals from ' + deals.length + ' total')
  return unique
}
