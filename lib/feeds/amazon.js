/**
 * Amazon Creators API feed fetcher
 *
 * Required env vars:
 *   AMAZON_CREATORS_ACCESS_KEY  — from Associates Central → Tools → Creators API
 *   AMAZON_CREATORS_SECRET_KEY  — same location
 *   AMAZON_ASSOCIATE_TAG        — eschooldeals-20
 */

const ASSOCIATE_TAG  = process.env.AMAZON_ASSOCIATE_TAG        || 'eschooldeals-20'
const ACCESS_KEY     = process.env.AMAZON_CREATORS_ACCESS_KEY
const SECRET_KEY     = process.env.AMAZON_CREATORS_SECRET_KEY

// Creators API base (replaces PA-API endpoint)
const CREATORS_BASE  = 'https://affiliate-program.amazon.com/creatorapi/paapi5'
const TOKEN_URL      = 'https://api.amazon.com/auth/o2/token'

// Student-relevant Amazon browse nodes / search indexes
const STUDENT_SEARCH_INDEXES = [
  'Electronics',
  'Computers',
  'VideoGames',
  'Software',
  'Books',
  'OfficeProducts',
]

const CATEGORY_MAP = {
  Electronics:    'Electronics',
  Computers:      'Computers',
  VideoGames:     'Toys',
  Software:       'Computers',
  Books:          'Today',
  OfficeProducts: 'Today',
}

const STUDENT_INDEXES = new Set(['Electronics', 'Computers', 'VideoGames', 'Software'])

/**
 * Get OAuth 2.0 token from Amazon
 */
async function getAccessToken() {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     ACCESS_KEY,
      client_secret: SECRET_KEY,
      scope:         'advertising::pa:read',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Amazon token error ${res.status}: ${text}`)
  }

  const { access_token } = await res.json()
  return access_token
}

/**
 * Search items for a given index
 */
async function searchItems(token, searchIndex) {
  const body = {
    Keywords:    'deal discount save',
    SearchIndex: searchIndex,
    Resources: [
      'ItemInfo.Title',
      'ItemInfo.ByLineInfo',
      'Offers.Listings.Price',
      'Offers.Listings.SavingBasis',
      'Offers.Listings.Availability.Type',
      'Offers.Listings.DeliveryInfo.IsPrimeEligible',
      'Images.Primary.Medium',
      'BrowseNodeInfo.BrowseNodes',
    ],
    PartnerTag:  ASSOCIATE_TAG,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.com',
    MaxResults:  10,
    SortBy:      'Featured',
  }

  const res = await fetch(`${CREATORS_BASE}/searchitems`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    console.warn(`[amazon] searchItems ${searchIndex} error ${res.status}:`, text)
    return []
  }

  const json = await res.json()
  return json?.SearchResult?.Items ?? []
}

/**
 * Normalize a raw Amazon item to our deal schema
 */
function normalizeItem(item, searchIndex) {
  const listing     = item.Offers?.Listings?.[0]
  if (!listing) return null

  const salePrice   = listing.Price?.Amount
  if (!salePrice)   return null

  const origPrice   = listing.SavingBasis?.Amount ?? null
  const discountPct = origPrice
    ? Math.round((1 - salePrice / origPrice) * 100)
    : 0

  // Only include items with a meaningful discount
  if (discountPct < 5 && !origPrice) return null

  const asin      = item.ASIN
  const title     = item.ItemInfo?.Title?.DisplayValue ?? ''
  const imageUrl  = item.Images?.Primary?.Medium?.URL ?? null
  const productUrl = `https://www.amazon.com/dp/${asin}?tag=${ASSOCIATE_TAG}`
  const inStock    = listing.Availability?.Type === 'Now'

  return {
    source_key:          'amazon',
    merchant:            'AMAZON',
    source_type:         'feed',
    external_id:         asin,
    title,
    category:            CATEGORY_MAP[searchIndex] ?? 'Electronics',
    original_price:      origPrice   ? Number(origPrice.toFixed(2))   : null,
    sale_price:          Number(salePrice.toFixed(2)),
    discount_pct:        discountPct,
    product_url:         productUrl,
    image_url:           imageUrl,
    currency:            listing.Price?.Currency ?? 'USD',
    in_stock:            inStock,
    is_student_relevant: STUDENT_INDEXES.has(searchIndex),
    is_featured:         discountPct >= 25,
    _raw:                item,
  }
}

/**
 * Main export — fetch Amazon deals across student-relevant categories
 */
export async function fetchAmazonDeals() {
  if (!ACCESS_KEY || !SECRET_KEY) {
    console.warn('[amazon] Missing AMAZON_CREATORS_ACCESS_KEY or AMAZON_CREATORS_SECRET_KEY — skipping')
    return []
  }

  let token
  try {
    token = await getAccessToken()
  } catch (err) {
    console.error('[amazon] Auth failed:', err.message)
    return []
  }

  const results = []

  for (const index of STUDENT_SEARCH_INDEXES) {
    try {
      const items = await searchItems(token, index)
      for (const item of items) {
        const normalized = normalizeItem(item, index)
        if (normalized) results.push(normalized)
      }
    } catch (err) {
      console.error(`[amazon] Error fetching ${index}:`, err.message)
    }
  }

  console.log(`[amazon] Fetched ${results.length} deals`)
  return results
}
