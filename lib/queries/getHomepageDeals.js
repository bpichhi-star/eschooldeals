import { getSupabaseAdmin, hasSupabaseAdminEnv } from '@/lib/db/supabaseAdmin'

// ─── Student-relevant category allowlist ───────────────────────────────────────
// Only these categories ever surface on the homepage.
// Everything else (baby, automotive, garden, pets, food, etc.) stays in the DB
// but is never shown to users.
const STUDENT_CATEGORIES = [
  'Electronics',
  'Computers',
  'Phones',
  'Accessories',
  'Home',
  'Fashion',
  'Sports',
  'General',
]

// Merchants that are fallback/unknown — exclude from homepage
const EXCLUDED_MERCHANTS = ['STORE', 'OTHER', '']

// ─── Price ceiling per category ────────────────────────────────────────────────
// Keeps aspirational but realistic for a student budget.
// Anything above these thresholds stays in the DB but won't surface.
const PRICE_CEILING = {
  Computers:   2500,  // MacBooks, gaming laptops, desktops — no ceiling that hurts students
  Electronics: 1500,  // iPads, monitors, TVs, Apple Watch, AirPods Max
  Phones:      1400,  // iPhones, flagship Android — students buy these
  Accessories: 300,
  Home:        500,
  Fashion:     200,
  Sports:      300,
  General:     150,
}

const DEFAULT_PRICE_CEILING = 500

// Minimum score to appear on homepage — filters out zero-info junk deals
const MIN_SCORE = 5

function mapDealRow(deal, index) {
  const salePrice = deal.sale_price  != null ? Number(deal.sale_price)  : null
  const origPrice = deal.original_price != null ? Number(deal.original_price) : null
  return {
    id:            deal.id ?? 'deal-' + index,
    title:         deal.title || '',
    merchant:      deal.merchant || 'AMAZON',
    category:      deal.category || 'General',
    originalPrice: origPrice,
    salePrice:     salePrice,
    discountPct:   deal.discount_pct ?? 0,
    url:           deal.product_url || '',
    image:         deal.image_url || null,
    isStudentPick: Boolean(deal.is_student_relevant),
    isFeatured:    Boolean(deal.is_featured),
    score:         deal.score ?? 0,
  }
}

function isStudentRelevant(deal) {
  // Must be in allowed category
  if (!STUDENT_CATEGORIES.includes(deal.category)) return false

  // Must have a real merchant name
  if (EXCLUDED_MERCHANTS.includes((deal.merchant || '').toUpperCase())) return false

  // Must have a price
  const price = Number(deal.sale_price)
  if (!price || price <= 0) return false

  // Must be under category price ceiling
  const ceiling = PRICE_CEILING[deal.category] ?? DEFAULT_PRICE_CEILING
  if (price > ceiling) return false

  // Must have minimum score
  if ((deal.score ?? 0) < MIN_SCORE) return false

  return true
}

export async function getHomepageDeals(limit = 300) {
  if (!hasSupabaseAdminEnv()) return []
  const supabase = getSupabaseAdmin()
  if (!supabase) return []

  // Pull a larger pool from Supabase filtered to allowed categories,
  // then apply client-side filters (price ceiling, merchant, score).
  // We over-fetch so that after filtering we still have enough deals.
  const fetchLimit = Math.min(limit * 4, 1200)

  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('status', 'active')
    .in('category', STUDENT_CATEGORIES)          // DB-level category filter
    .gt('sale_price', 0)                         // must have a price
    .gte('score', MIN_SCORE)                     // minimum score at DB level
    .order('is_featured',  { ascending: false })
    .order('score',        { ascending: false, nullsFirst: false })
    .order('created_at',   { ascending: false })
    .limit(fetchLimit)

  if (error || !data || data.length === 0) return []

  // Apply remaining filters client-side (price ceiling, merchant check)
  const filtered = data.filter(isStudentRelevant)

  return filtered.slice(0, limit).map(mapDealRow)
}
