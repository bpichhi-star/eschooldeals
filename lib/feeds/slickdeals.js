// lib/feeds/slickdeals.js
//
// Slickdeals is used as a DEAL DISCOVERY source only — we never expose any
// slickdeals.net URLs to users. The RSS no longer carries direct merchant
// URLs — every href in the description is wrapped as
// `slickdeals.net/click?lno=...&u3=<token>`. Two-step extraction:
//
//   1. ASIN-first (free, no HTTP) — if the item HTML carries `data-aps-asin`
//      or any embedded `/dp/{ASIN}` link, we build a clean amazon.com URL
//      and let buildAffiliateUrl() apply our associate tag. This handles the
//      Amazon majority instantly.
//
//   2. Click-resolver — for everything else, we follow the slickdeals.net/click
//      URL with redirect:'manual' and read the Location header to get the real
//      merchant URL. Resolutions are batched in groups of 8 with per-fetch
//      timeouts so a slow Slickdeals server can't blow the function budget.
//
// Items where neither path succeeds are dropped (no slickdeals.net URLs ever
// reach users). Woot deals are dropped entirely until the CJ Woot publisher
// relationship is reactivated — see the README in lib/utils/affiliateUrl.js.

import { categorize }                                          from '@/lib/utils/categorize'
import { buildAffiliateUrl, extractAsin, extractExitVendor }   from '@/lib/utils/affiliateUrl'

const FEEDS = [
  { url: 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1', label: 'slickdeals-frontpage' },
  { url: 'https://slickdeals.net/newsearch.php?mode=popdeals&searcharea=deals&searchin=first&rss=1',  label: 'slickdeals-popular'   },
  { url: 'https://slickdeals.net/newsearch.php?mode=topdeals&searcharea=deals&searchin=first&rss=1',  label: 'slickdeals-top'       },
]

// Resolver tuning. 8-wide concurrency × 4s per request = 4s per batch worst-case.
// At 50 items/feed × 3 feeds with ~30% caught by ASIN, ~100 items need resolution
// → ~13 batches × 4s = ~52s worst-case, but typical responses are much faster
// (Slickdeals click handler usually responds in 100-500ms). 60s function budget.
const RESOLVE_BATCH_SIZE   = 8
const RESOLVE_TIMEOUT_MS   = 4000
const MAX_REDIRECT_HOPS    = 4
const BATCH_JITTER_MIN_MS  = 50
const BATCH_JITTER_MAX_MS  = 150

// Merchants we explicitly refuse to surface, regardless of feed:
//   - woot.com: CJ Woot publisher relationship inactive — wrapped links 404
//     until BPMAKER re-applies via members.cj.com joinprograms.do.
const SKIP_MERCHANTS = new Set(['woot.com'])

// Anything still hosted on a deals aggregator after resolution = give up.
const AGGREGATOR_DOMAINS = new Set([
  'slickdeals.net', 'edealinfo.com', 'dealnews.com',
  'dealsea.com',    'dealsplus.com',  'bfads.net',     'gottadeal.com',
])

// Affiliate-redirect networks that wrap the real merchant URL. Slickdeals's
// click handler often lands on one of these, NOT the merchant directly. We
// extract the destination from a query param (faster + more reliable than
// chasing another HTTP redirect). Hosts may be subdomains of these (e.g.
// champssports.4xc4ep.net for Awin sub-tracker). Awin/Impact/Partnerize each
// rotate through dozens of randomly-named tracker subdomains; the generic
// fallback in unwrapAffiliateRedirect() catches the long tail.
const AFFILIATE_REDIRECT_HOSTS = new Set([
  // Awin (incl. randomly-named sub-trackers)
  'awin1.com', '4xc4ep.net', '7tiv.net', 'o42l.net',
  // Sovrn
  'sjv.io', 'igs4ds.net',
  // Partnerize / Performance Horizon
  'pntra.com', 'pntrac.com', 'prf.hn',
  // Pepperjam (now Partnerize/Awin)
  'pjatr.com',
  // Impact Radius
  'pxf.io',
  // Skimlinks
  'go.redirectingat.com', 'redirectingat.com',
  // CJ Affiliate
  'anrdoezrs.net', 'dpbolvw.net', 'jdoqocy.com', 'kqzyfj.com', 'tkqlhce.com',
  // Rakuten LinkShare
  'click.linksynergy.com', 'linksynergy.com',
  // Walmart/Target Impact storefronts (still affiliate-wrapped)
  'goto.walmart.com', 'goto.target.com',
  // Misc
  'rover.ebay.com', 'shopstyle.it',
])

// Param names known to encode the real merchant URL on the affiliate networks
// above. Checked in order; first non-empty value wins.
const DEST_PARAM_NAMES = ['u', 'url', 'ued', 'dest', 'destination', 'murl', 'RD_PARM1']

// Drop deals whose titles mention pet/baby/automotive/etc. items at INGEST
// (rather than letting them sit in pending until manual reject). Mirrors the
// homepage's TITLE_BLOCKLIST in lib/queries/getHomepageDeals.js so the two
// stages stay in sync.
const TITLE_BLOCKLIST = /\b(dog|cat|pet|puppy|kitten|bird|fish tank|aquarium|hamster|rabbit|guinea pig|baby|infant|toddler|diaper|pacifier|stroller|crib|car seat|automotive|oil filter|wiper blade|car part|tire|brake|caster|chair wheel|office chair wheel|furniture leg|desk leg|table leg|cabinet hinge|door hinge|plumbing|toilet|faucet|sink|bathtub|lawn|garden|fertilizer|mulch|weed|pesticide|insecticide|hunting|ammo|firearm|gun|knife blade|tactical)\b/i

// Drop multi-deal aggregator titles where the resolved URL points to ONE item
// but the title implies a range or bundle. These mislead users and the
// per-item price is unrecoverable.
const VAGUE_TITLE_RE = /\b(?:and much more|& much more|much more on sale|and more deals|& more deals|various items|various deals)\b/i

function isHostMatch(url, set) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    for (const domain of set) {
      if (host === domain || host.endsWith('.' + domain)) return true
    }
    return false
  } catch { return false }
}

function isAggregatorUrl(url) { return isHostMatch(url, AGGREGATOR_DOMAINS) }
function isSkippedMerchant(url) { return isHostMatch(url, SKIP_MERCHANTS) }
function isAffiliateRedirect(url) { return isHostMatch(url, AFFILIATE_REDIRECT_HOSTS) }

// If `url` is an affiliate-redirect (Awin/Sovrn/Skimlinks/CJ/Impact/etc.),
// pull the real merchant destination out of its query params. Returns null
// if not detected as an affiliate wrapper.
//
// Two-tier detection:
//   1. Known affiliate-network host (fast path) — see AFFILIATE_REDIRECT_HOSTS
//   2. Generic shape detection — host has a `u`/`url`/`ued`/`dest` param whose
//      value is an https URL on a different host. This catches the long tail
//      of random-named tracker subdomains (Awin and Impact rotate through
//      hundreds; we'd be playing whack-a-mole otherwise).
function unwrapAffiliateRedirect(url) {
  try {
    const u = new URL(url)
    const wrapperHost = u.hostname.replace(/^www\./, '')
    const isKnownAffiliate = isAffiliateRedirect(url)

    for (const name of DEST_PARAM_NAMES) {
      const v = u.searchParams.get(name)
      if (!v || !/^https?:\/\//i.test(v)) continue
      // For known-affiliate hosts, accept any http(s) destination.
      // For unknown hosts, require the destination to be on a DIFFERENT host
      // than the wrapper — that's the signal that this is a redirect rather
      // than a legitimate URL that happens to have a "url" param.
      if (isKnownAffiliate) return v
      try {
        const destHost = new URL(v).hostname.replace(/^www\./, '')
        if (destHost && destHost !== wrapperHost) return v
      } catch { /* malformed dest, skip */ }
    }
    return null
  } catch { return null }
}

// Friendly merchant display name from a resolved URL host
function merchantName(url = '') {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const map = {
      'amazon.com':       'AMAZON',
      'amzn.to':          'AMAZON',
      'walmart.com':      'WALMART',
      'woot.com':         'WOOT',
      'bestbuy.com':      'BEST BUY',
      'target.com':       'TARGET',
      'ebay.com':         'EBAY',
      'homedepot.com':    'HOME DEPOT',
      'lowes.com':        "LOWE'S",
      'newegg.com':       'NEWEGG',
      'costco.com':       'COSTCO',
      'adorama.com':      'ADORAMA',
      'bhphotovideo.com': 'B&H',
      'macys.com':        "MACY'S",
      'adidas.com':       'ADIDAS',
      'nike.com':         'NIKE',
      'samsclub.com':     "SAM'S CLUB",
      'kohls.com':        "KOHL'S",
      'staples.com':      'STAPLES',
      'officedepot.com':  'OFFICE DEPOT',
      'lenovo.com':       'LENOVO',
      'dell.com':         'DELL',
      'hp.com':           'HP',
      'apple.com':        'APPLE',
      'samsung.com':      'SAMSUNG',
      'gamestop.com':     'GAMESTOP',
      'antonline.com':    'ANTONLINE',
      'rei.com':          'REI',
    }
    for (const [domain, name] of Object.entries(map)) {
      if (host === domain || host.endsWith('.' + domain)) return name
    }
    return host.split('.')[0].toUpperCase()
  } catch { return 'STORE' }
}

// ── Step 1: ASIN extraction (free, no HTTP) ──────────────────────────────────
// Reuses extractAsin from affiliateUrl.js which checks both `data-aps-asin="..."`
// and `/dp/ASIN` patterns.

// ── Step 2: click-URL resolution ─────────────────────────────────────────────

// Pull the slickdeals.net/click URL out of the item HTML. Slickdeals sometimes
// repeats the same href twice (one for the merchant name, one for the bracketed
// domain link); we only need the first.
function extractClickUrl(html = '') {
  if (!html) return null
  const m = html.match(/href=["'](https?:\/\/slickdeals\.net\/click\?[^"']+)["']/i)
  if (!m) return null
  // RSS XML entity-encodes & inside attribute values; un-decode for the fetch
  return m[1].replace(/&amp;/g, '&').replace(/&#38;/g, '&')
}

// Follow the slickdeals click URL, return the final merchant URL or null.
// Uses redirect:'manual' so we can inspect each Location ourselves and stop
// chasing if it loops or lands on an unsupported merchant.
async function resolveClickUrl(clickUrl, hops = 0) {
  if (hops > MAX_REDIRECT_HOPS) return null
  const controller = new AbortController()
  const timeout    = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS)
  try {
    const res = await fetch(clickUrl, {
      method:   'GET',
      redirect: 'manual',
      signal:   controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':     '*/*',
      },
    })
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return null
      // Chained slickdeals redirect (rare) — keep following
      if (/slickdeals\.net/i.test(location)) return resolveClickUrl(location, hops + 1)
      return location
    }
    // 200 or other — slickdeals served the page itself; can't extract
    return null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// ── RSS parsing helpers (unchanged from prior version) ───────────────────────

// Extract the deal's headline price from the title. Slickdeals titles follow
// rough conventions like:
//   "Acme Widget $19.99 + Free Shipping"
//   "$24.99 | Acme Widget"
//   "Acme Widget for $24.99"
//   "Acme Widget $19.99 w/S&S, (As Low As $17.50)"
//
// The first $X.XX in the title is reliably the headline price — NOT the
// minimum across all matches, which would pick up cashback amounts, "free
// shipping w/ $35+", "as low as $X" footnotes, etc. The "as low as" / "from"
// alternates can be lower than the first match but they refer to a variant
// the resolved URL may not match.
//
// Returns { sale_price, original_price } where original_price is null unless
// the title contains a strikethrough indicator like "(reg. $X)" or
// "$X off" or "Save $X" that lets us infer the pre-sale price.
function extractTitlePrice(title = '') {
  // Find the FIRST $X.XX (or $X) in the title — that's the headline price.
  const priceMatches = [...title.matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g)]
    .map(m => ({ value: parseFloat(m[1].replace(/,/g, '')), index: m.index }))
    .filter(p => p.value > 0 && p.value < 10000)

  if (!priceMatches.length) return null

  // Headline price = first $X.XX. Most slickdeals titles put it right after
  // the product name. Where titles lead with the price (e.g. "$24.99 | …"),
  // it's still the first match.
  const sale = priceMatches[0].value

  // Try to detect an explicit pre-sale price from common phrasings.
  // "(reg. $99.99)" / "(was $99.99)" / "List $99.99" / "MSRP $99.99"
  let original = null
  const regMatch = title.match(/\b(?:reg(?:ular)?|was|list|msrp|orig(?:inal)?|retail)\.?\s*:?\s*\$([\d,]+(?:\.\d{1,2})?)/i)
  if (regMatch) {
    const o = parseFloat(regMatch[1].replace(/,/g, ''))
    if (o > sale) original = o
  }

  return { sale_price: sale, original_price: original }
}

function stripHtml(html = '') {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractCDATA(tag, xml) {
  const re = new RegExp('<' + tag + '[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/' + tag + '>|<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i')
  const m = xml.match(re)
  return m ? (m[1] || m[2] || '').trim() : ''
}

function extractImage(html = '') {
  const m = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
  return m ? m[1] : null
}

function cleanTitle(title = '') {
  return title
    .replace(/^\$[\d,]+\.?\d*\s*\|\s*/, '')
    .replace(/\s+at\s+\w[\w\s&']*\!?\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 255)
}

// ── Per-item parser ─────────────────────────────────────────────────────────

// parseItem returns one of:
//   { deal: <obj>, reason: null }   — kept, ready to upsert
//   { deal: null,  reason: '<code>' } — dropped, with the bucket so a
//                                       diagnostic endpoint can aggregate
//
// Drop reason codes (used by /api/debug/slickdeals-stats):
//   no_title, blocklist, vague_title, exit_woot, no_click_url,
//   resolve_failed, still_wrapped, aggregator, skipped_merchant,
//   no_product_url, no_price
function parseItemResult(deal) { return { deal, reason: null } }
function parseItemDrop(reason) { return { deal: null, reason } }

async function parseItem(itemXml, feedLabel) {
  const title   = extractCDATA('title', itemXml)
  const desc    = extractCDATA('description', itemXml)
  const encoded = extractCDATA('content:encoded', itemXml)
  const guid    = extractCDATA('guid', itemXml)
  const linkM   = itemXml.match(/<link>([^<]+)<\/link>/)
  const sdLink  = linkM ? linkM[1].trim() : ''
  if (!title) return parseItemDrop('no_title')

  // Title-quality filters BEFORE any HTTP work — cheap rejects.
  if (TITLE_BLOCKLIST.test(title)) return parseItemDrop('blocklist')
  if (VAGUE_TITLE_RE.test(title))  return parseItemDrop('vague_title')

  const html = encoded || desc

  // Step 1: ASIN-first. If we find one, we never need to call slickdeals.
  const asin = extractAsin(html)
  let merchantUrl = null

  if (asin) {
    merchantUrl = 'https://www.amazon.com/dp/' + asin
  } else {
    // Step 2: Pre-filter via the exit-website hint baked into the anchor.
    // No HTTP yet — just a regex match on data-product-exitWebsite.
    const exitVendor = extractExitVendor(html)
    if (exitVendor && SKIP_MERCHANTS.has(exitVendor)) return parseItemDrop('exit_woot')

    // Step 3: Resolve the slickdeals.net/click URL.
    const clickUrl = extractClickUrl(html)
    if (!clickUrl) return parseItemDrop('no_click_url')
    let resolved = await resolveClickUrl(clickUrl)
    if (!resolved) return parseItemDrop('resolve_failed')

    // Step 4: If the resolution landed on an affiliate redirect (Awin, Sovrn,
    // Skimlinks, CJ, Walmart Impact, etc.), unwrap the destination from its
    // query params instead of chasing another HTTP redirect.
    const unwrapped = unwrapAffiliateRedirect(resolved)
    if (unwrapped) resolved = unwrapped

    if (isAffiliateRedirect(resolved)) return parseItemDrop('still_wrapped')
    if (isAggregatorUrl(resolved))     return parseItemDrop('aggregator')
    if (isSkippedMerchant(resolved))   return parseItemDrop('skipped_merchant')
    merchantUrl = resolved
  }

  // buildAffiliateUrl handles: tag injection for Amazon/Walmart, CJ wrap for
  // Woot (we already filtered Woot above), tracking-param strip for everyone
  // else. Idempotent for already-wrapped Amazon/Walmart URLs.
  const product_url = buildAffiliateUrl(merchantUrl, asin)
  if (!product_url) return parseItemDrop('no_product_url')

  // Headline price from the title only — NOT the minimum across all $X.XX
  // matches, which would pick up cashback, "free shipping w/ $35+", etc.
  const priced = extractTitlePrice(title)
  if (!priced) return parseItemDrop('no_price')
  const { sale_price, original_price } = priced
  const discount_pct = original_price ? Math.round((1 - sale_price / original_price) * 100) : 0

  const image    = extractImage(html)
  const merchant = merchantName(merchantUrl)
  const category = categorize(title, stripHtml(html))

  return parseItemResult({
    source_key:          feedLabel,
    external_id:         guid || sdLink || merchantUrl,  // never user-facing
    merchant,
    source_type:         'rss',
    title:               cleanTitle(title),
    category,
    sale_price,
    original_price,
    discount_pct,
    product_url,
    image_url:           image || null,
    currency:            'USD',
    in_stock:            true,
    is_student_relevant: ['Electronics', 'Computers', 'Phones', 'Accessories'].includes(category) && (discount_pct >= 15 || sale_price < 100),
    is_featured:         false,
    fetched_at:          new Date().toISOString(),
    // Slickdeals lands as PENDING — admin reviews via /admin (default filter
    // is pending) and clicks "Activate all" or rejects per-item. Slickdeals
    // titles are user-submitted on the source side and prone to misleading
    // wording, multi-deal aggregations, and price/spec drift; manual review
    // is the safety net.
    status:              'pending',
  })
}

// ── Per-feed parser with parallel batched resolution ─────────────────────────

async function parseFeed(xml, feedLabel) {
  const itemRe   = /<item>([\s\S]*?)<\/item>/gi
  const itemXmls = []
  let m
  while ((m = itemRe.exec(xml)) !== null) itemXmls.push(m[1])

  const results = []
  const drops   = []  // collected drop reasons for diagnostics

  // Batch resolutions to bound concurrency. Small jitter between batches keeps
  // us a bit more polite to Slickdeals's click endpoint.
  for (let i = 0; i < itemXmls.length; i += RESOLVE_BATCH_SIZE) {
    const batch        = itemXmls.slice(i, i + RESOLVE_BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(itemXml => parseItem(itemXml, feedLabel).catch(e => {
        console.warn('[slickdeals] parse error:', e.message)
        return parseItemDrop('exception')
      })),
    )
    for (const r of batchResults) {
      if (r.deal) results.push(r.deal)
      else drops.push(r.reason)
    }
    if (i + RESOLVE_BATCH_SIZE < itemXmls.length) {
      const jitter = BATCH_JITTER_MIN_MS + Math.random() * (BATCH_JITTER_MAX_MS - BATCH_JITTER_MIN_MS)
      await new Promise(r => setTimeout(r, jitter))
    }
  }

  if (drops.length > 0) {
    console.log('[slickdeals] ' + feedLabel + ': kept ' + results.length + ', dropped ' + drops.length + ' of ' + itemXmls.length)
  }
  return { kept: results, drops, totalItems: itemXmls.length }
}

// Internal — fetches all 3 feeds and returns BOTH kept deals and drop
// reasons. Used by fetchSlickdealsDeals (production path) and by the
// /api/debug/slickdeals-stats endpoint (diagnostic path).
async function fetchAllFeedsRaw() {
  const results = await Promise.allSettled(
    FEEDS.map(async ({ url, label }) => {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept':     'application/rss+xml, application/xml, text/xml, */*',
        },
        next: { revalidate: 0 },
      })
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + label)
      const xml = await res.text()
      const { kept, drops, totalItems } = await parseFeed(xml, label)
      console.log('[slickdeals] ' + label + ': ' + kept.length + ' kept, ' + drops.length + ' dropped of ' + totalItems)
      return { label, kept, drops, totalItems }
    }),
  )

  const perFeed = []
  for (const r of results) {
    if (r.status === 'rejected') {
      console.warn('[slickdeals] feed error:', r.reason?.message || r.reason)
      continue
    }
    perFeed.push(r.value)
  }
  return perFeed
}

export async function fetchSlickdealsDeals() {
  console.log('[slickdeals] Fetching ' + FEEDS.length + ' feeds')
  const perFeed = await fetchAllFeedsRaw()
  const all     = perFeed.flatMap(f => f.kept)
  const seen    = new Set()
  return all.filter(d => {
    if (seen.has(d.external_id)) return false
    seen.add(d.external_id)
    return true
  })
}

// Diagnostic variant — returns full per-feed breakdown including drops.
// Used by /api/debug/slickdeals-stats so we can see exactly how many items
// each filter is removing without touching the production ingest path.
export async function fetchSlickdealsDealsWithStats() {
  const perFeed   = await fetchAllFeedsRaw()
  const all       = perFeed.flatMap(f => f.kept)
  const seen      = new Set()
  const dedupKept = []
  let dedupDropped = 0
  for (const d of all) {
    if (seen.has(d.external_id)) { dedupDropped++; continue }
    seen.add(d.external_id)
    dedupKept.push(d)
  }
  return { perFeed, dedupKept, dedupDropped }
}
