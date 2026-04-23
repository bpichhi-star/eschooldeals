/**
 * Woot deals via CJ Product Search API
 *
 * Required env vars:
 *   CJ_PERSONAL_ACCESS_TOKEN  — from developers.cj.com → API Keys
 *   CJ_PUBLISHER_ID           — 7936037
 *   CJ_WOOT_ADVERTISER_ID     — find in CJ dashboard → Advertisers → search Woot
 */

const CJ_TOKEN           = process.env.CJ_PERSONAL_ACCESS_TOKEN
const CJ_PUBLISHER_ID    = process.env.CJ_PUBLISHER_ID    || '7936037'
const WOOT_ADVERTISER_ID = process.env.CJ_WOOT_ADVERTISER_ID

const CJ_PRODUCT_SEARCH  = 'https://product-search.api.cj.com/v2/product-search'

const STUDENT_KEYWORDS = [
  'laptop', 'tablet', 'headphone', 'monitor', 'keyboard',
  'mouse', 'webcam', 'speaker', 'phone', 'gaming',
]

/**
 * Fetch products from CJ Product Search API
 * CJ returns XML — we parse it manually
 */
async function fetchCJProducts(params = {}) {
  const url = new URL(CJ_PRODUCT_SEARCH)
  url.searchParams.set('website-id',     CJ_PUBLISHER_ID)
  url.searchParams.set('advertiser-ids', WOOT_ADVERTISER_ID)
  url.searchParams.set('records-per-page', '100')
  url.searchParams.set('page-number',    '1')
  url.searchParams.set('sort-by',        'sale-price')
  url.searchParams.set('sort-order',     'desc')
  url.searchParams.set('currency',       'USD')

  // Apply any overrides
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${CJ_TOKEN}`,
      Accept:        'application/xml',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`CJ API error ${res.status}: ${text.slice(0, 300)}`)
  }

  const xml = await res.text()
  return parseXML(xml)
}

/**
 * Lightweight XML parser for CJ product feed
 * Returns array of product objects
 */
function parseXML(xml) {
  const products = []
  const productBlocks = [...xml.matchAll(/<product>([\s\S]*?)<\/product>/g)]

  for (const [, block] of productBlocks) {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
      return m ? (m[1] ?? m[2] ?? '').trim() : ''
    }

    const salePrice  = parseFloat(get('sale-price')   || get('price'))
    const retailPrice = parseFloat(get('retail-price') || '0')

    if (!salePrice || isNaN(salePrice)) continue

    products.push({
      sku:          get('sku'),
      name:         get('name'),
      description:  get('description'),
      imageUrl:     get('image-url'),
      buyUrl:       get('buy-url'),
      salePrice,
      retailPrice:  isNaN(retailPrice) ? null : retailPrice,
      inStock:      get('in-stock').toLowerCase() !== 'no',
      manufacturer: get('manufacturer-name'),
    })
  }

  return products
}

/**
 * Check if a product name is student-relevant
 */
function isStudentRelevant(name = '', description = '') {
  const text = `${name} ${description}`.toLowerCase()
  return STUDENT_KEYWORDS.some(kw => text.includes(kw))
}

/**
 * Normalize CJ product to our deal schema
 */
function normalizeProduct(p) {
  const discountPct = p.retailPrice && p.retailPrice > p.salePrice
    ? Math.round((1 - p.salePrice / p.retailPrice) * 100)
    : 0

  const studentRelevant = isStudentRelevant(p.name, p.description)

  return {
    source_key:          'woot',
    merchant:            'WOOT',
    source_type:         'feed',
    external_id:         p.sku || null,
    title:               p.name,
    category:            'Electronics',
    original_price:      p.retailPrice || null,
    sale_price:          p.salePrice,
    discount_pct:        discountPct,
    product_url:         p.buyUrl,
    image_url:           p.imageUrl || null,
    currency:            'USD',
    in_stock:            p.inStock,
    is_student_relevant: studentRelevant,
    is_featured:         discountPct >= 25,
    _raw:                p,
  }
}

/**
 * Main export — fetch Woot deals via CJ
 */
export async function fetchWootDeals() {
  if (!CJ_TOKEN) {
    console.warn('[woot] Missing CJ_PERSONAL_ACCESS_TOKEN — skipping')
    return []
  }

  if (!WOOT_ADVERTISER_ID) {
    console.warn('[woot] Missing CJ_WOOT_ADVERTISER_ID — skipping')
    return []
  }

  try {
    const products = await fetchCJProducts()
    const deals    = products.map(normalizeProduct)
    console.log(`[woot] Fetched ${deals.length} deals`)
    return deals
  } catch (err) {
    console.error('[woot] Fetch failed:', err.message)
    return []
  }
}
