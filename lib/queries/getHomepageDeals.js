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
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data || data.length === 0) {
    return fallbackDeals
  }

  return data.map((deal, index) => ({
    id: deal.id ?? `deal-${index}`,
    title: deal.title,
    merchant: deal.store,
    category: deal.category || 'Today',
    originalPrice: deal.original_price ?? deal.price,
    salePrice: deal.price,
    discountPct: deal.discount_pct ?? 0,
    productUrl: deal.url,
    url: deal.url,
    image: deal.image_url,
    thumbBg: '#f5f5f7',
    isStudentPick: false,
  }))
}
