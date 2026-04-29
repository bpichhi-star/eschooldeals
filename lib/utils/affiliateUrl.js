// lib/utils/affiliateUrl.js
//
// Single source of truth for affiliate-wrapping product URLs.
// Used by both feed parsers and the admin manual-deal POST.
//
// Active affiliate programs:
//   - Amazon  → tag eschooldeal0a-20 (env AMAZON_ASSOCIATE_TAG)
//   - Woot    → CJ deep-link via anrdoezrs.net (env CJ_PUBLISHER_ID + CJ_WOOT_ADVERTISER_ID)
//   - Walmart → wmlspartner via Impact (env WALMART_AFFILIATE_ID)
//
// Declined / not enrolled (URLs pass through clean, no tracking):
//   - Best Buy, Target, eBay, and everything else

// Query params we always strip from incoming URLs — covers Amazon Associates,
// Slickdeals tag injection, Impact, CJ click-through residue, generic UTM,
// and Slickdeals-internal RSS tracking. We strip BEFORE applying our own
// affiliate ID so we never end up "stacking" someone else's tag onto our URL.
const STRIP_PARAMS = new Set([
  // Amazon Associates / SiteStripe / Slickdeals-on-Amazon
  'tag', 'linkCode', 'linkId', 'ascsubtag', 'asc_campaign', 'asc_source',
  'asc_refurl', 'creative', 'creativeASIN', 'adid', 'camp', 'ref', 'ref_',
  // Walmart / Impact
  'wmlspartner', 'veh', 'sourceid', 'affp1', 'affp2',
  // Generic UTM
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  // Generic click / sub IDs
  'clickid', 'click_id', 'subid', 'sub_id', 'cid',
  // Impact Radius
  'irclickid', 'irgwc', 'iradid', 'irpid',
  // Rakuten / generic affiliate networks
  'ranMID', 'ranEAID', 'ranSiteID', 'ClickID', 'PublisherID',
  'afftrack', 'affid', 'aff_id', 'partnerID', 'partner_id',
  // Slickdeals internal RSS / feed tracking
  'sdfib', 'lno', 'pv', 'au', 'u3', 'trd',
])

const AMAZON_TAG            = process.env.AMAZON_ASSOCIATE_TAG
const CJ_PUBLISHER_ID       = process.env.CJ_PUBLISHER_ID       || '7936037'
const CJ_WOOT_ADVERTISER_ID = process.env.CJ_WOOT_ADVERTISER_ID || '4909784'
const WALMART_AFFILIATE_ID  = process.env.WALMART_AFFILIATE_ID

function cleanUrl(rawUrl) {
  try {
    const url = new URL(rawUrl)
    for (const key of [...url.searchParams.keys()]) {
      if (STRIP_PARAMS.has(key) || STRIP_PARAMS.has(key.toLowerCase())) {
        url.searchParams.delete(key)
      }
    }
    url.hash = ''
    return url.toString()
  } catch {
    return rawUrl
  }
}

function detectVendor(url = '') {
  const u = url.toLowerCase()
  if (u.includes('amazon.com') || u.includes('amzn.to')) return 'amazon'
  if (u.includes('woot.com'))         return 'woot'
  if (u.includes('walmart.com'))      return 'walmart'
  if (u.includes('bestbuy.com'))      return 'bestbuy'
  if (u.includes('target.com'))       return 'target'
  if (u.includes('ebay.com'))         return 'ebay'
  if (u.includes('homedepot.com'))    return 'homedepot'
  if (u.includes('lowes.com'))        return 'lowes'
  if (u.includes('macys.com'))        return 'macys'
  if (u.includes('newegg.com'))       return 'newegg'
  if (u.includes('costco.com'))       return 'costco'
  if (u.includes('adorama.com'))      return 'adorama'
  if (u.includes('bhphotovideo.com')) return 'bhphoto'
  if (u.includes('adidas.com'))       return 'adidas'
  if (u.includes('nike.com'))         return 'nike'
  return 'other'
}

// Returns true if url is already wrapped in our CJ deep-link
function isAlreadyCJWrapped(url = '') {
  const u = url.toLowerCase()
  return u.includes('anrdoezrs.net') || u.includes('dpbolvw.net') ||
         u.includes('jdoqocy.com')   || u.includes('kqzyfj.com')  ||
         u.includes('tkqlhce.com')
}

export function buildAffiliateUrl(rawUrl, asin = null) {
  if (!rawUrl) return rawUrl

  // Already wrapped in CJ — leave alone, don't double-wrap
  if (isAlreadyCJWrapped(rawUrl)) return rawUrl

  const vendor = detectVendor(rawUrl)

  // ── Amazon: clean, then apply our associate tag ─────────────────────────
  if (vendor === 'amazon') {
    if (asin && AMAZON_TAG) return `https://www.amazon.com/dp/${asin}?tag=${AMAZON_TAG}`
    const clean = cleanUrl(rawUrl)
    if (!AMAZON_TAG) return clean
    try {
      const u = new URL(clean)
      u.searchParams.set('tag', AMAZON_TAG)
      return u.toString()
    } catch { return clean }
  }

  // ── Woot: wrap in CJ deep-link ──────────────────────────────────────────
  if (vendor === 'woot') {
    const clean = cleanUrl(rawUrl)
    if (!CJ_PUBLISHER_ID || !CJ_WOOT_ADVERTISER_ID) return clean
    return `https://www.anrdoezrs.net/click-${CJ_PUBLISHER_ID}-${CJ_WOOT_ADVERTISER_ID}?url=${encodeURIComponent(clean)}`
  }

  // ── Walmart: wmlspartner via Impact ─────────────────────────────────────
  if (vendor === 'walmart') {
    const clean = cleanUrl(rawUrl)
    if (!WALMART_AFFILIATE_ID) return clean
    const sep = clean.includes('?') ? '&' : '?'
    return `${clean}${sep}veh=aff&wmlspartner=${WALMART_AFFILIATE_ID}`
  }

  // ── Best Buy, Target, eBay, everything else: clean URL only, no tracking ─
  return cleanUrl(rawUrl)
}

export function extractAsin(html = '') {
  const m = html.match(/data-aps-asin="([A-Z0-9]{10})"/) ||
            html.match(/\/dp\/([A-Z0-9]{10})/)
  return m ? m[1] : null
}

export function extractExitVendor(html = '') {
  const m = html.match(/data-product-exitWebsite="([^"]+)"/)
  return m ? m[1].toLowerCase() : null
}

export { cleanUrl, detectVendor }
