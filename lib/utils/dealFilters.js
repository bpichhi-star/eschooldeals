// Shared filter for student-relevant deals. Used by both the homepage
// query (lib/queries/getHomepageDeals.js) and the archive route
// (app/api/deals/archive/route.js) so the two views stay consistent —
// a deal that shows on the homepage shows in the archive, and vice versa.
//
// Admin-curated deals (source_key='manual' OR is_featured=true) bypass
// these filters: admin's judgment overrides automated cleanup.

export const STUDENT_CATEGORIES = [
  'Electronics','Computers','Phones','Accessories','Home','Fashion','Sports','General',
]

export const EXCLUDED_MERCHANTS = ['STORE', 'OTHER', '']

// Hard blocklist — titles containing these patterns never show on homepage
// or archive, regardless of category. Catches:
//   - non-student lifecycle items: pet, baby, automotive
//   - residential-install gear: in-ceiling/in-wall/floor speakers, etc.
//   - home/garden/plumbing/lawn equipment
//   - food/grocery items (we're a deals site, not a grocery aggregator)
//   - office/desk/cabinet hardware not relevant to students
//   - hunting/firearm items
//
// Note: bare 'cat' was previously here and false-matched 'Cat-6' networking
// cables. Replaced with specific cat-product phrases below so networking
// gear stays visible. Same surgical-phrase approach applied elsewhere.
export const TITLE_BLOCKLIST = /\b(dog|cat food|cat litter|cat toy|cat tree|cat scratcher|cat carrier|cat collar|cat bed|cat harness|pet|puppy|kitten|bird|fish tank|aquarium|hamster|rabbit|guinea pig|baby|infant|toddler|diaper|pacifier|stroller|crib|car seat|automotive|oil filter|wiper blade|car part|tire|brake|caster|chair wheel|office chair wheel|furniture leg|desk leg|table leg|cabinet hinge|door hinge|plumbing|toilet|faucet|sink|bathtub|lawn|garden|fertilizer|mulch|weed|pesticide|insecticide|hunting|ammo|firearm|gun|knife blade|tactical|in-ceiling|in-wall speaker|floor.?standing|floor speaker|satellite speaker|center.?channel|outdoor speaker|ceiling speaker|drywall anchor|lazy susan|outdoor cooler|cooler cart|hearth.?and.?hand|vinyl|2lp|180g|taco shell|oreo|reese|chocolate.?sandwich|peanut butter chocolate|cereal|frozen meal)\b/i

// Maximum sale price for deals that don't have an original_price set.
// Without an MSRP we can't show a discount badge, so we trust source-feed
// curation only for cheap items where the price alone implies a deal.
const MAX_PRICE_NO_MSRP = 300

// True if deal should appear on homepage / archive. Same rule for both.
export function isStudentRelevant(deal) {
  // Admin-curated deals always show — admin's judgment overrides everything.
  // Two flags cover this:
  //   - source_key === 'manual'  : entered via /admin "Add Deal Manually"
  //   - is_featured === true     : promoted to ESD Recommended strip
  // Both still need a positive sale_price to render.
  if (deal.source_key === 'manual' || deal.is_featured === true) {
    const price = Number(deal.sale_price)
    return Boolean(price && price > 0)
  }

  // Category whitelist
  if (!STUDENT_CATEGORIES.includes(deal.category)) return false

  // Merchant blocklist (placeholder/junk merchants)
  if (EXCLUDED_MERCHANTS.includes((deal.merchant || '').toUpperCase())) return false

  const sale = Number(deal.sale_price)
  if (!sale || sale <= 0) return false

  // Real-deal filter: must EITHER have a verified discount OR be cheap enough
  // to trust the source feed's "this is a deal" signal without an MSRP.
  const orig = Number(deal.original_price)
  const hasMsrp = deal.original_price != null && orig > 0
  const hasRealDiscount = hasMsrp && orig > sale && (deal.discount_pct ?? 0) >= 5
  const cheapNoMsrp = !hasMsrp && sale <= MAX_PRICE_NO_MSRP
  if (!hasRealDiscount && !cheapNoMsrp) return false

  // Title-pattern junk filter (residential audio install, food, etc.)
  if (TITLE_BLOCKLIST.test(deal.title || '')) return false

  return true
}
