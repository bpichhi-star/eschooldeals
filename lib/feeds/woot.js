/**
 * Woot deals via CJ Affiliate GraphQL API (ads.api.cj.com)
 *
 * Required env vars:
 *   CJ_PERSONAL_ACCESS_TOKEN — from developers.cj.com → API Keys
 *   CJ_PUBLISHER_ID          — your CJ publisher/website ID (e.g. 7936037)
 *   CJ_WOOT_ADVERTISER_ID    — Woot advertiser ID in CJ dashboard
 */

const CJ_TOKEN = process.env.CJ_PERSONAL_ACCESS_TOKEN
const CJ_PUBLISHER_ID = process.env.CJ_PUBLISHER_ID || '7936037'
const WOOT_ADVERTISER_ID = process.env.CJ_WOOT_ADVERTISER_ID

const CJ_GRAPHQL_URL = 'https://ads.api.cj.com/query'

const STUDENT_KEYWORDS = [
    'laptop', 'tablet', 'headphone', 'monitor', 'keyboard',
    'mouse', 'webcam', 'speaker', 'phone', 'gaming',
  ]

/**
   * Fetch products from CJ GraphQL API
   */
async function fetchCJProducts() {
    const query = `
        query GetProducts($publisherId: String!, $advertiserIds: [String!]!, $limit: Int!) {
              products(
                      publisherId: $publisherId
                              advertiserIds: $advertiserIds
                                      limit: $limit
                                            ) {
                                                    resultList {
                                                              advertiserId
                                                                        advertiserName
                                                                                  catalogId
                                                                                            currency
                                                                                                      description
                                                                                                                id
                                                                                                                          imageLink
                                                                                                                                    inStock
                                                                                                                                              lastUpdated
                                                                                                                                                        link
                                                                                                                                                                  manufacturerName
                                                                                                                                                                            price
                                                                                                                                                                                      retailPrice
                                                                                                                                                                                                salePrice
                                                                                                                                                                                                          sku
                                                                                                                                                                                                                    title
                                                                                                                                                                                                                            }
                                                                                                                                                                                                                                    totalCount
                                                                                                                                                                                                                                          }
                                                                                                                                                                                                                                              }
                                                                                                                                                                                                                                                `

  const variables = {
        publisherId: CJ_PUBLISHER_ID,
        advertiserIds: [WOOT_ADVERTISER_ID],
        limit: 100,
  }

  const res = await fetch(CJ_GRAPHQL_URL, {
        method: 'POST',
        headers: {
                'Authorization': `Bearer ${CJ_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
  })

  if (!res.ok) {
        const text = await res.text()
        throw new Error(`CJ GraphQL HTTP error ${res.status}: ${text.slice(0, 300)}`)
  }

  const json = await res.json()

  if (json.errors && json.errors.length > 0) {
        throw new Error(`CJ GraphQL error: ${json.errors[0].message}`)
  }

  return json?.data?.products?.resultList ?? []
}

/**
 * Check if a product name is student-relevant
 */
function isStudentRelevant(name = '', description = '') {
    const text = `${name} ${description}`.toLowerCase()
    return STUDENT_KEYWORDS.some(kw => text.includes(kw))
}

/**
 * Normalize CJ GraphQL product to our deal schema
 */
function normalizeProduct(p) {
    const salePrice = parseFloat(p.salePrice || p.price || '0')
    const retailPrice = parseFloat(p.retailPrice || '0')

  if (!salePrice || isNaN(salePrice)) return null

  const discountPct = retailPrice && retailPrice > salePrice
      ? Math.round((1 - salePrice / retailPrice) * 100)
        : 0

  const studentRelevant = isStudentRelevant(p.title, p.description)

  return {
        source_key: 'woot',
        merchant: 'WOOT',
        source_type: 'feed',
        external_id: p.sku || p.id || null,
        title: p.title,
        category: 'Electronics',
        original_price: isNaN(retailPrice) || retailPrice === 0 ? null : retailPrice,
        sale_price: salePrice,
        discount_pct: discountPct,
        product_url: p.link,
        image_url: p.imageLink || null,
        currency: p.currency || 'USD',
        in_stock: p.inStock !== false,
        is_student_relevant: studentRelevant,
        is_featured: discountPct >= 25,
        _raw: p,
  }
}

/**
 * Main export — fetch Woot deals via CJ GraphQL
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
        const deals = products
          .map(normalizeProduct)
          .filter(Boolean)
        console.log(`[woot] Fetched ${deals.length} deals`)
        return deals
  } catch (err) {
        console.error('[woot] Fetch failed:', err.message)
        return []
  }
}
