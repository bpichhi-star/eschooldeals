import { getSupabaseAdmin, hasSupabaseAdminEnv } from '@/lib/db/supabaseAdmin'

function mapDealRow(deal, index) {
  return {
    id:             deal.id ?? `deal-${index}`,
    title:          deal.title || '',
    merchant:       deal.merchant || 'AMAZON',
    category:       deal.category || 'Today',
    originalPrice:  deal.original_price  != null ? Number(deal.original_price)  : null,
    salePrice:      deal.sale_price      != null ? Number(deal.sale_price)       : null,
    discountPct:    deal.discount_pct    ?? 0,
    url:            deal.product_url     || '',
    image:          deal.image_url       || null,
    isStudentPick:  Boolean(deal.is_student_relevant),
    isFeatured:     Boolean(deal.is_featured),
    score:          deal.score           ?? 0,
  }
}

export async function getHomepageDeals(limit = 60) {
  if (!hasSupabaseAdminEnv()) return []

  const supabase = getSupabaseAdmin()
  if (!supabase) return []

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('status', 'active')
    .eq('in_stock', true)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('score', { ascending: false, nullsFirst: false })
    .order('fetched_at', { ascending: false })
    .limit(limit)

  if (error || !data || data.length === 0) return []

  return data.map(mapDealRow)
}
