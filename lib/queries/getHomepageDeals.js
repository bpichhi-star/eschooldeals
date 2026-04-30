import { getSupabaseAdmin, hasSupabaseAdminEnv } from '@/lib/db/supabaseAdmin'
import { isStudentRelevant } from '@/lib/utils/dealFilters'

async function expireStaleDeals(supabase) {
  const now = new Date().toISOString()
  // Semantics: expires_at IS NULL → evergreen (admin-curated, no time-based expire).
  // Otherwise auto-expire when expires_at < now(). NULL < value is NULL in SQL,
  // so .lt('expires_at', now) naturally skips NULL rows without an explicit
  // filter. This applies uniformly to all deals — admin-set expiration dates
  // on featured/manual deals are honored.
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
    sortOrder:     deal.sort_order != null ? Number(deal.sort_order) : null,
    clickCount:    deal.click_count != null ? Number(deal.click_count) : 0,
    createdAt:     deal.created_at || null,
    expiresAt:     deal.expires_at || null,
  }
}

export async function getHomepageDeals(limit = 2000) {
  if (!hasSupabaseAdminEnv()) return []
  const supabase = getSupabaseAdmin()
  if (!supabase) return []

  await expireStaleDeals(supabase)

  // Default order: newest first. The grid's per-card sort can be overridden
  // by the user via the sort dropdown on the homepage. Featured items still
  // appear in the ESD strip up top (which has its own sort_order ordering),
  // so we don't need to pin them in the main grid.
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('status', 'active')
    .gt('sale_price', 0)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data || data.length === 0) return []

  return data.filter(isStudentRelevant).map(mapDealRow)
}
