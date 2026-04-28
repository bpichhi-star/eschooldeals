import { getSupabaseAdmin, hasSupabaseAdminEnv } from '@/lib/db/supabaseAdmin'

const STUDENT_CATEGORIES = ['Electronics','Computers','Phones','Accessories','Home','Fashion','Sports','General']
const EXCLUDED_MERCHANTS = ['STORE', 'OTHER', '']

const PRICE_CEILING = {
  Computers:   2500,
  Electronics: 1500,
  Phones:      1400,
  Accessories: 300,
  Home:        500,
  Fashion:     200,
  Sports:      300,
  General:     150,
}
const DEFAULT_PRICE_CEILING = 500
const MIN_SCORE = 5

// ─── Actively expire any deals past midnight ET ───────────────────────────────
// Called on every homepage load so expired deals are never shown between ingest runs
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
    category:      deal.category || 'General',
    originalPrice: deal.original_price != null ? Number(deal.original_price) : null,
    salePrice:     deal.sale_price    != null ? Number(deal.sale_price)    : null,
    discountPct:   deal.discount_pct ?? 0,
    url:           deal.product_url || '',
    image:         deal.image_url || null,
    isStudentPick: Boolean(deal.is_student_relevant),
    isFeatured:    Boolean(deal.is_featured),
    score:         deal.score ?? 0,
  }
}

function isStudentRelevant(deal) {
  if (!STUDENT_CATEGORIES.includes(deal.category)) return false
  if (EXCLUDED_MERCHANTS.includes((deal.merchant || '').toUpperCase())) return false
  const price = Number(deal.sale_price)
  if (!price || price <= 0) return false
  const ceiling = PRICE_CEILING[deal.category] ?? DEFAULT_PRICE_CEILING
  if (price > ceiling) return false
  if ((deal.score ?? 0) < MIN_SCORE) return false
  return true
}

// ─── No hard cap — show all valid active student deals ────────────────────────
export async function getHomepageDeals(limit = 2000) {
  if (!hasSupabaseAdminEnv()) return []
  const supabase = getSupabaseAdmin()
  if (!supabase) return []

  // 1. Expire anything past midnight ET before fetching
  await expireStaleDeals(supabase)

  // 2. Fetch all active student-relevant deals — no arbitrary cap
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('status', 'active')
    .in('category', STUDENT_CATEGORIES)
    .gt('sale_price', 0)
    .gte('score', MIN_SCORE)
    .order('is_featured',  { ascending: false })
    .order('score',        { ascending: false, nullsFirst: false })
    .order('created_at',   { ascending: false })
    .limit(limit)

  if (error || !data || data.length === 0) return []

  // 3. Client-side filters (price ceiling, merchant)
  return data.filter(isStudentRelevant).map(mapDealRow)
}
