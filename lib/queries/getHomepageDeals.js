import { getSupabaseAdmin, hasSupabaseAdminEnv } from '@/lib/db/supabaseAdmin'

// General is intentionally excluded — anything that doesn't match a specific
// category is too vague to be student-relevant (office chair wheels, dog beds, etc.)
const STUDENT_CATEGORIES = ['Electronics','Computers','Phones','Accessories','Home','Fashion','Sports']

const EXCLUDED_MERCHANTS = ['STORE', 'OTHER', '']

const PRICE_CEILING = {
  Computers:   2500,
  Electronics: 1500,
  Phones:      1400,
  Accessories: 300,
  Home:        500,
  Fashion:     200,
  Sports:      300,
}
const DEFAULT_PRICE_CEILING = 500

// Hard blocklist — titles containing these words never show on the homepage
// regardless of category. Catches pet, baby, automotive, and office supply items
// that slip through with vague categories.
const TITLE_BLOCKLIST = /\b(dog|cat|pet|puppy|kitten|bird|fish tank|aquarium|hamster|rabbit|guinea pig|baby|infant|toddler|diaper|pacifier|stroller|crib|car seat|automotive|oil filter|wiper blade|car part|tire|brake|caster|chair wheel|office chair wheel|furniture leg|desk leg|table leg|cabinet hinge|door hinge|plumbing|toilet|faucet|sink|bathtub|lawn|garden|fertilizer|mulch|weed|pesticide|insecticide|hunting|ammo|firearm|gun|knife blade|tactical)\b/i

async function expireStaleDeals(supabase) {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('deals')
    .update({ status: 'expired', updated_at: now })
    .eq('status', 'active')
    .lt('expires_at', now)
  if (error) console.error('[getHomepageDeals] expire error:', error.message)
}

function mapDealRow(deal, index) {
  return {
    id:            deal.id ?? 'deal-' + index,
    title:         deal.title || '',
    merchant:      deal.merchant || 'AMAZON',
    category:      deal.category || 'Electronics',
    originalPrice: deal.original_price != null ? Number(deal.original_price) : null,
    salePrice:     deal.sale_price    != null ? Number(deal.sale_price)    : null,
    discountPct:   deal.discount_pct ?? 0,
    url:           deal.product_url || '',
    image:         deal.image_url || null,
    isStudentPick: Boolean(deal.is_student_relevant),
    isFeatured:    Boolean(deal.is_featured),
  }
}

function isStudentRelevant(deal) {
  if (!STUDENT_CATEGORIES.includes(deal.category)) return false
  if (EXCLUDED_MERCHANTS.includes((deal.merchant || '').toUpperCase())) return false
  const price = Number(deal.sale_price)
  if (!price || price <= 0) return false
  const ceiling = PRICE_CEILING[deal.category] ?? DEFAULT_PRICE_CEILING
  if (price > ceiling) return false
  // Hard blocklist — filter out pet, baby, automotive, office furniture parts etc.
  if (TITLE_BLOCKLIST.test(deal.title || '')) return false
  return true
}

export async function getHomepageDeals(limit = 2000) {
  if (!hasSupabaseAdminEnv()) return []
  const supabase = getSupabaseAdmin()
  if (!supabase) return []

  await expireStaleDeals(supabase)

  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('status', 'active')
    .in('category', STUDENT_CATEGORIES)
    .gt('sale_price', 0)
    .order('is_featured',  { ascending: false })
    .order('discount_pct', { ascending: false, nullsFirst: false })
    .order('created_at',   { ascending: false })
    .limit(limit)

  if (error || !data || data.length === 0) return []

  return data.filter(isStudentRelevant).map(mapDealRow)
}
