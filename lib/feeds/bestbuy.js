// lib/feeds/bestbuy.js
//
// Pulls deals from Best Buy via their official Products API.
// Free tier: 50,000 calls/day (we use ~7-30 per cron run).
//
// Two endpoints:
//   1. Products API with onSale=true filter — main sale listings
//   2. Open Box API by category — Excellent / Certified open-box deals
//
// IMPORTANT (Best Buy ToS):
//   - Music and movie products require Affiliate Program membership for
//     purchase redirection. We exclude type=Music and type=Movie below.
//   - Response click-tracking URLs expire after 7 days — fine because our
//     cron refreshes deals nightly. external_id = sku ensures upsert
//     refreshes the URL on every run.
//
// Docs: https://bestbuyapis.github.io/api-documentation/

import { categorize, mapExternalCategory } from '@/lib/utils/categorize'
import { buildAffiliateUrl } from '@/lib/utils/affiliateUrl'

const API_KEY = process.env.BESTBUY_API_KEY
const BASE    = 'https://api.bestbuy.com/v1'
const BETA    = 'https://api.bestbuy.com/beta'

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; eschooldeals-bot/1.0)',
  'Accept':     'application/json',
}

const FETCH_TIMEOUT_MS = 20000

// ─── Categories — student-relevant slices of Best Buy's catalog ───────────────
// Each category produces ~50 deals/run with our filters. 4 categories × 1 query
// = 4 ScraperAPI-style requests, all free under Best Buy's 50K/day limit.
const SALE_CATEGORIES = [
  { id: 'abcat0500000', label: 'bestbuy-computers',  category: 'Computers'   }, // Computers & Tablets
  { id: 'abcat0200000', label: 'bestbuy-audio',      category: 'Electronics' }, // Audio (headphones, speakers)
  { id: 'abcat0107000', label: 'bestbuy-tv-acc',     category: 'Electronics' }, // TV & Home Theater Accessories
  { id: 'abcat0900000', label: 'bestbuy-appliances', category: 'Home'        }, // Appliances (mini fridges, microwaves)
]

// ─── Open Box categories — these yield the deepest student discounts ──────────
const OPEN_BOX_CATEGORIES = [
  { id: 'abcat0500000', label: 'bestbuy-openbox-computers',  category: 'Computers'   },
  { id: 'abcat0200000', label: 'bestbuy-openbox-audio',      category: 'Electronics' },
]

// ─── Quality filters ──────────────────────────────────────────────────────────
const MIN_SALE_PRICE      = 5
const MIN_DISCOUNT_PCT    = 10
const MIN_REVIEW_COUNT    = 10
const PAGE_SIZE           = 100
const EXCLUDED_TYPES      = new Set(['Movie', 'Music', 'BlackTie'])

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function fetchWithTimeout(url, opts = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, cache: 'no-store' })
  } finally {
    clearTimeout(t)
  }
}

function computeDiscount(sale, regular) {
  if (!sale || !regular || regular <= sale) return 0
  return Math.round((1 - sale / regular) * 100)
}

function fixImageUrl(url) {
  // Best Buy serves https images, but some legacy responses return http
  if (!url || typeof url !== 'string') return null
  return url.replace(/^http:\/\//, 'https://')
}

function isStudentRelevantTitle(title = '') {
  // Hard exclusions for things slipping through Best Buy categories
  const blocklist = /\b(extended warranty|geek squad|protection plan|gift card|bundle subscription|microsoft 365 1.year|installation service|set up service)\b/i
  return !blocklist.test(title)
}

// ─── Map a Products API product → our deal schema ─────────────────────────────
function mapSaleProduct(product, feedConfig) {
  const sku       = product.sku
  const title     = product.name?.trim()
  const sale      = Number(product.salePrice)
  const regular   = Number(product.regularPrice)
  const reviews   = Number(product.customerReviewCount) || 0

  if (!sku || !title || !sale || sale < MIN_SALE_PRICE) return null
  if (!product.onSale) return null
  if (EXCLUDED_TYPES.has(product.type)) return null
  if (!isStudentRelevantTitle(title)) return null

  const discount_pct = computeDiscount(sale, regular)
  if (discount_pct < MIN_DISCOUNT_PCT) return null
  if (reviews < MIN_REVIEW_COUNT) return null

  const image     = fixImageUrl(product.image || product.thumbnailImage)
  if (!image) return null

  // Best Buy returns either api.bestbuy.com/click/... (expires in 7 days) or
  // direct bestbuy.com URL. We use whatever they give us; cron refresh keeps
  // it current.
  const rawUrl = product.url
  if (!rawUrl || !rawUrl.startsWith('http')) return null

  const titleClean = title.replace(/\s+only\s+\$[\d.,]+\s*$/i, '').trim().slice(0, 255)

  // Use mapped category for homepage filtering, fall back to feed default
  const catFromTitle = mapExternalCategory ? mapExternalCategory('', title) : categorize(title, '')
  const finalCategory = catFromTitle || feedConfig.category

  return {
    source_key:          feedConfig.label,
    external_id:         'bb-' + String(sku),
    merchant:            'BEST BUY',
    source_type:         'api',
    title:               titleClean,
    category:            finalCategory,
    sale_price:          sale,
    original_price:      regular > sale ? regular : null,
    discount_pct,
    product_url:         buildAffiliateUrl(rawUrl),
    image_url:           image,
    currency:            'USD',
    in_stock:            product.onlineAvailability !== false,
    is_student_relevant: discount_pct >= 15 && ['Electronics', 'Computers', 'Phones', 'Accessories'].includes(finalCategory),
    is_featured:         false,
    score:               Math.min(discount_pct, 50)
                       + 10                                   // image always present (filtered above)
                       + (reviews >= 100 ? 10 : reviews >= 50 ? 5 : 0)
                       + (Number(product.customerReviewAverage) >= 4.5 ? 5 : 0),
    fetched_at:          new Date().toISOString(),
    status:              'active',
  }
}

// ─── Map an Open Box result → our deal schema ─────────────────────────────────
function mapOpenBoxProduct(item, feedConfig) {
  const sku       = item.sku
  const title     = item.names?.title?.trim()
  if (!sku || !title) return null
  if (!isStudentRelevantTitle(title)) return null

  // Open Box can have multiple offers (excellent / certified) — pick the cheapest.
  const offers = Array.isArray(item.offers) ? item.offers : []
  if (!offers.length) return null
  const cheapest = offers.reduce((best, o) => {
    const cur = Number(o.prices?.current)
    if (!best || cur < Number(best.prices?.current)) return o
    return best
  }, null)
  if (!cheapest) return null

  const sale      = Number(cheapest.prices?.current)
  const regular   = Number(cheapest.prices?.regular) || Number(item.prices?.regular)
  const reviews   = Number(item.customerReviews?.count) || 0

  if (!sale || sale < MIN_SALE_PRICE) return null

  const discount_pct = computeDiscount(sale, regular)
  if (discount_pct < MIN_DISCOUNT_PCT) return null
  if (reviews < MIN_REVIEW_COUNT) return null

  const image = fixImageUrl(item.images?.standard)
  if (!image) return null

  const rawUrl = item.links?.web
  if (!rawUrl || !rawUrl.startsWith('http')) return null

  const titleSuffix = cheapest.condition === 'certified' ? ' (Geek Squad Certified)' : ' (Open Box)'
  const fullTitle   = (title + titleSuffix).slice(0, 255)

  const catFromTitle = mapExternalCategory ? mapExternalCategory('', title) : categorize(title, '')
  const finalCategory = catFromTitle || feedConfig.category

  return {
    source_key:          feedConfig.label,
    external_id:         'bb-ob-' + String(sku) + '-' + cheapest.condition,
    merchant:            'BEST BUY',
    source_type:         'api',
    title:               fullTitle,
    category:            finalCategory,
    sale_price:          sale,
    original_price:      regular > sale ? regular : null,
    discount_pct,
    product_url:         buildAffiliateUrl(rawUrl),
    image_url:           image,
    currency:            'USD',
    in_stock:            true,
    is_student_relevant: discount_pct >= 15 && ['Electronics', 'Computers', 'Phones', 'Accessories'].includes(finalCategory),
    is_featured:         false,
    score:               Math.min(discount_pct, 50)
                       + 10                                   // image always present
                       + 8                                    // open-box bonus
                       + (reviews >= 100 ? 10 : reviews >= 50 ? 5 : 0),
    fetched_at:          new Date().toISOString(),
    status:              'active',
  }
}

// ─── Sale fetch: Products API with onSale=true filter ─────────────────────────
async function fetchSaleByCategory(feedConfig) {
  if (!API_KEY) return []

  const SHOW = [
    'sku', 'name', 'salePrice', 'regularPrice', 'onSale', 'percentSavings',
    'image', 'thumbnailImage', 'url', 'manufacturer', 'type',
    'customerReviewAverage', 'customerReviewCount', 'onlineAvailability',
  ].join(',')

  // Sort by percent savings descending — biggest discounts first
  const filter = '(onSale=true&categoryPath.id=' + feedConfig.id + '&active=true)'
  const url    = BASE + '/products' + filter
              + '?format=json&pageSize=' + PAGE_SIZE
              + '&show=' + SHOW
              + '&sort=percentSavings.desc'
              + '&apiKey=' + API_KEY

  try {
    const res = await fetchWithTimeout(url, { headers: BROWSER_HEADERS })
    if (!res.ok) {
      const body = await res.text()
      console.warn('[bestbuy] sale ' + feedConfig.label + ' HTTP ' + res.status + ' (' + body.slice(0, 100) + ')')
      return []
    }
    const data     = await res.json()
    const products = Array.isArray(data.products) ? data.products : []
    const deals    = products.map(p => mapSaleProduct(p, feedConfig)).filter(Boolean)
    console.log('[bestbuy] sale ' + feedConfig.label + ': ' + deals.length + ' deals from ' + products.length + ' products (total avail: ' + data.total + ')')
    return deals
  } catch (e) {
    console.error('[bestbuy] sale ' + feedConfig.label + ' error: ' + e.message)
    return []
  }
}

// ─── Open Box fetch: /beta/products/openBox(categoryId=X) ──────────────────────
async function fetchOpenBoxByCategory(feedConfig) {
  if (!API_KEY) return []

  // Open Box endpoint is paginated via page/pageSize (max 100 per page)
  const url = BETA + '/products/openBox(categoryId=' + feedConfig.id + ')'
            + '?pageSize=100&apiKey=' + API_KEY

  try {
    const res = await fetchWithTimeout(url, { headers: BROWSER_HEADERS })
    if (!res.ok) {
      const body = await res.text()
      console.warn('[bestbuy] openbox ' + feedConfig.label + ' HTTP ' + res.status + ' (' + body.slice(0, 100) + ')')
      return []
    }
    const data    = await res.json()
    const results = Array.isArray(data.results) ? data.results : []
    const deals   = results.map(r => mapOpenBoxProduct(r, feedConfig)).filter(Boolean)
    console.log('[bestbuy] openbox ' + feedConfig.label + ': ' + deals.length + ' deals from ' + results.length + ' offers')
    return deals
  } catch (e) {
    console.error('[bestbuy] openbox ' + feedConfig.label + ' error: ' + e.message)
    return []
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export async function fetchBestBuyDeals() {
  if (!API_KEY) {
    console.warn('[bestbuy] BESTBUY_API_KEY not set — skipping')
    return []
  }

  console.log('[bestbuy] Fetching ' + SALE_CATEGORIES.length + ' sale + ' + OPEN_BOX_CATEGORIES.length + ' open-box categories')

  const saleResults    = await Promise.allSettled(SALE_CATEGORIES.map(fetchSaleByCategory))
  const openBoxResults = await Promise.allSettled(OPEN_BOX_CATEGORIES.map(fetchOpenBoxByCategory))

  const all = [
    ...saleResults.filter(r => r.status === 'fulfilled').flatMap(r => r.value),
    ...openBoxResults.filter(r => r.status === 'fulfilled').flatMap(r => r.value),
  ]

  // Dedupe by external_id
  const seen = new Set()
  const deduped = all.filter(d => {
    if (!d?.external_id || seen.has(d.external_id)) return false
    seen.add(d.external_id)
    return true
  })

  console.log('[bestbuy] TOTAL: ' + deduped.length + ' unique deals from ' + all.length + ' raw')
  return deduped
}
