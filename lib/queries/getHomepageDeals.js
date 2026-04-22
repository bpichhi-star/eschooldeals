import { getSupabaseAdmin, hasSupabaseAdminEnv } from '@/lib/db/supabaseAdmin'
import { deals as fallbackDeals } from '@/lib/deals'

export async function getHomepageDeals(limit = 40) {
  if (!hasSupabaseAdminEnv()) {
    return fallbackDeals
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return fallbackDeals
  }

  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('status', 'active')
    .eq('in_stock', true)
    .order('score', { ascending: false })
    .order('fetched_at', { ascending: false })
    .limit(limit)

  if (error || !data || data.length === 0) {
    return fallbackDeals
  }

  return data.map((deal, index) => ({
    id: deal.id ?? `${deal.source_key}-${index}`,
    title: deal.title,
    merchant: deal.merchant,
    category: deal.category,
    originalPrice: deal.original_price ?? deal.sale_price,
    salePrice: deal.sale_price,
    discountPct: deal.discount_pct ?? 0,
    productUrl: deal.product_url,
    url: deal.product_url,
    image: deal.image_url,
    thumbBg: '#f5f5f7',
    isStudentPick: deal.is_student_relevant ?? false,
  }))
}
