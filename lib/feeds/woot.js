/**
 * Woot deals via CJ Affiliate GraphQL API (ads.api.cj.com)
 */

const CJ_TOKEN           = process.env.CJ_PERSONAL_ACCESS_TOKEN
const CJ_PUBLISHER_ID    = process.env.CJ_PUBLISHER_ID || '7936037'
const WOOT_ADVERTISER_ID = process.env.CJ_WOOT_ADVERTISER_ID

const CJ_GRAPHQL_URL = 'https://ads.api.cj.com/query'

const STUDENT_KEYWORDS = [
  'laptop', 'tablet', 'headphone', 'monitor', 'keyboard',
  'mouse', 'webcam', 'speaker', 'phone', 'gaming',
]

async function fetchCJProducts() {
  const query = `
    query GetProducts($companyId: ID!, $advertiserIds: [ID!]!) {
      products(
        companyId: $companyId
        partnerIds: $advertiserIds
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
          price { amount currency }
          salePrice { amount currency }
          title
        }
        totalCount
      }
    }
  `

  const variables = {
    companyId: CJ_PUBLISHER_ID,
    advertiserIds: WOOT_ADVERTISER_ID ? [WOOT_ADVERTISER_ID] : [],
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

function isStudentRelevant(name = '', description = '') {
  const text = `${name} ${description}`.toLowerCase()
  return STUDENT_KEYWORDS.some(kw => text.includes(kw))
}

function normalizeProduct(p) {
  const listPrice = parseFloat(p.price?.amount || '0')
  const salePrice = parseFloat(p.salePrice?.amount || p.price?.amount || '0')
  const currency  = p.price?.currency || p.salePrice?.currency || 'USD'

  if (!salePrice || isNaN(salePrice)) return null

  const discountPct = listPrice && listPrice > salePrice
    ? Math.round((1 - salePrice / listPrice) * 100)
    : 0

  return {
    source_key:          'woot',
    merchant:            'WOOT',
    source_type:         'feed',
    external_id:         p.id || null,
    title:               p.title,
    category:            'Electronics',
    original_price:      isNaN(listPrice) || listPrice === 0 ? null : listPrice,
    sale_price:          salePrice,
    discount_pct:        discountPct,
    product_url:         p.link,
    image_url:           p.imageLink || null,
    currency,
    in_stock:            true,
    is_student_relevant: isStudentRelevant(p.title, p.description),
    is_featured:         discountPct >= 25,
    _raw:                p,
  }
}

export async function fetchWootDeals() {
  if (!CJ_TOKEN) {
    console.warn('[woot] Missing CJ_PERSONAL_ACCESS_TOKEN — skipping')
    return []
  }
  try {
    const products = await fetchCJProducts()
    const deals = products.map(normalizeProduct).filter(Boolean)
    console.log(`[woot] Fetched ${deals.length} deals from CJ`)
    return deals
  } catch (err) {
    console.error('[woot] Fetch failed:', err.message)
    return []
  }
}
