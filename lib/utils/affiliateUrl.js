// lib/utils/affiliateUrl.js
const STRIP_PARAMS = new Set([
  'tag','linkCode','linkId','ascsubtag','asc_campaign','asc_source','asc_refurl','creative','creativeASIN','adid','camp','ref','ref_',
  'wmlspartner','veh','sourceid','affp1','affp2',
  'utm_source','utm_medium','utm_campaign','utm_content','utm_term',
  'clickid','click_id','subid','sub_id','cid','irclickid','irgwc','iradid','irpid',
  'ranMID','ranEAID','ranSiteID','ClickID','PublisherID','afftrack','affid','aff_id','partnerID','partner_id',
  'sdfib','lno','pv','au','u3','trd',
])

function cleanUrl(rawUrl) {
  try {
    const url = new URL(rawUrl)
    for (const key of [...url.searchParams.keys()]) {
      if (STRIP_PARAMS.has(key) || STRIP_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key)
    }
    url.hash = ''
    return url.toString()
  } catch { return rawUrl }
}

function detectVendor(url = '') {
  const u = url.toLowerCase()
  if (u.includes('amazon.com') || u.includes('amzn.to')) return 'amazon'
  if (u.includes('walmart.com'))    return 'walmart'
  if (u.includes('woot.com'))       return 'woot'
  if (u.includes('bestbuy.com'))    return 'bestbuy'
  if (u.includes('target.com'))     return 'target'
  if (u.includes('ebay.com'))       return 'ebay'
  if (u.includes('homedepot.com'))  return 'homedepot'
  if (u.includes('lowes.com'))      return 'lowes'
  if (u.includes('macys.com'))      return 'macys'
  if (u.includes('newegg.com'))     return 'newegg'
  if (u.includes('costco.com'))     return 'costco'
  if (u.includes('adorama.com'))    return 'adorama'
  if (u.includes('bhphotovideo.com')) return 'bhphoto'
  if (u.includes('adidas.com'))     return 'adidas'
  if (u.includes('nike.com'))       return 'nike'
  return 'other'
}

export function buildAffiliateUrl(rawUrl, asin = null) {
  const vendor = detectVendor(rawUrl)
  if (vendor === 'amazon' || vendor === 'woot') {
    const tag = process.env.AMAZON_ASSOCIATE_TAG
    if (asin && tag) return `https://www.amazon.com/dp/${asin}?tag=${tag}`
    const clean = cleanUrl(rawUrl)
    if (tag) { const url = new URL(clean); url.searchParams.set('tag', tag); return url.toString() }
    return clean
  }
  if (vendor === 'walmart') {
    const id = process.env.WALMART_AFFILIATE_ID
    const clean = cleanUrl(rawUrl)
    if (!id) return clean
    const sep = clean.includes('?') ? '&' : '?'
    return `${clean}${sep}veh=aff&wmlspartner=${id}`
  }
  if (vendor === 'ebay') {
    const campId = process.env.EBAY_CAMPAIGN_ID
    const clean = cleanUrl(rawUrl)
    if (!campId) return clean
    return `https://rover.ebay.com/rover/1/711-53200-19255-0/1?type=1&campid=${campId}&customid=&ext=${encodeURIComponent(clean)}&mpt=[[MPTID]]`
  }
  if (vendor === 'bestbuy') {
    const id = process.env.BESTBUY_AFFILIATE_ID
    const clean = cleanUrl(rawUrl)
    if (!id) return clean
    return `${clean}${clean.includes('?') ? '&' : '?'}irclickid=${id}`
  }
  if (vendor === 'target') {
    const id = process.env.TARGET_AFFILIATE_ID
    const clean = cleanUrl(rawUrl)
    if (!id) return clean
    return `${clean}${clean.includes('?') ? '&' : '?'}afid=${id}`
  }
  return cleanUrl(rawUrl)
}

export function extractAsin(html = '') {
  const m = html.match(/data-aps-asin="([A-Z0-9]{10})"/)
  return m ? m[1] : null
}

export function extractExitVendor(html = '') {
  const m = html.match(/data-product-exitWebsite="([^"]+)"/)
  return m ? m[1].toLowerCase() : null
}

export { cleanUrl, detectVendor }
