/**
 * Woot deals via CJ Affiliate GraphQL API (ads.api.cj.com)
 *
 * Required env vars:
 *   CJ_PERSONAL_ACCESS_TOKEN — from developers.cj.com → API Keys
 *   CJ_PUBLISHER_ID          — your CJ publisher/website ID (e.g. 7936037)
 *   CJ_WOOT_ADVERTISER_ID    — Woot advertiser ID in CJ dashboard (used for filtering)
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
       * Confirmed fields: advertiserId, advertiserName, description, id, imageLink, link,
       *   price { amount currency }, salePrice { amount currency }, sku, title
       * NOT valid: retailPrice, manufacturerName, currency, inStock
       */
async function fetchCJProducts() {
        const query = `
            query GetProducts($partnerIds: [String!]!) {
                  products(
                          partnerIds: $partnerIds
                                  partnerStatus: JOINED
                                          limit: 100
                                                ) {
                                                        resultList {
                                                                  advertiserId
                                                                            advertiserName
                                                                                      description
                                                                                                id
                                                                                                          imageLink
                                                                                                                    link
                                                                                                                              price {
                                                                                                                                          amount
                                                                                                                                                      currency
                                                                                                                                                                }
                                                                                                                                                                          salePrice {
                                                                                                                                                                                      amount
                                                                                                                                                                                                  currency
                                                                                                                                                                                                            }
                                                                                                                                                                                                                      sku
                                                                                                                                                                                                                                title
                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                totalCount
                                                                                                                                                                                                                                                      }
                                                                                                                                                                                                                                                          }
                                                                                                                                                                                                                                                            `

  const variables = {
            partnerIds: [CJ_PUBLISHER_ID],
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

  const allProducts = json?.data?.products?.resultList ?? []

          // Filter to Woot advertiser if ID is set
          if (WOOT_ADVERTISER_ID) {
                    return allProducts.filter(p => String(p.advertiserId) === String(WOOT_ADVERTISER_ID))
          }

  return allProducts
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
 * price and salePrice are { amount, currency } objects
 * Use price as list price, salePrice as sale price
 */
function normalizeProduct(p) {
        const listPrice = parseFloat(p.price?.amount || '0')
        const salePrice = parseFloat(p.salePrice?.amount || p.price?.amount || '0')
        const currency = p.price?.currency || p.salePrice?.currency || 'USD'

  if (!salePrice || isNaN(salePrice)) return null

  const discountPct = listPrice && listPrice > salePrice
          ? Math.round((1 - salePrice / listPrice) * 100)
            : 0

  const studentRelevant = isStudentRelevant(p.title, p.description)

  return {
            source_key: 'woot',
            merchant: 'WOOT',
            source_type: 'feed',
            external_id: p.sku || p.id || null,
            title: p.title,
            category: 'Electronics',
            original_price: isNaN(listPrice) || listPrice === 0 ? null : listPrice,
            sale_price: salePrice,
            discount_pct: discountPct,
            product_url: p.link,
            image_url: p.imageLink || null,
            currency,
            in_stock: true,
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

  try {
            const products = await fetchCJProducts()
            const deals = products
              .map(normalizeProduct)
              .filter(Boolean)
            console.log(`[woot] Fetched ${deals.length} deals from CJ`)
            return deals
  } catch (err) {
            console.error('[woot] Fetch failed:', err.message)
            return []
  }
}
