import { getSupabaseAdmin, hasSupabaseAdminEnv } from '@/lib/db/supabaseAdmin'

function mapDealRow(deal, index) {
    const salePrice = deal.price ?? deal.sale_price ?? null
    const originalPrice = deal.original_price ?? salePrice ?? null
    return {
          id: deal.id ?? `deal-${index}`,
          title: deal.title || '',
          merchant: deal.store || deal.merchant || 'AMAZON',
          category: deal.category || 'Today',
          originalPrice: originalPrice !== null ? Number(originalPrice) : null,
          salePrice: salePrice !== null ? Number(salePrice) : null,
          discountPct: deal.discount_pct ?? 0,
          productUrl: deal.url || deal.product_url || '',
          url: deal.url || deal.product_url || '',
          image: deal.image_url || null,
          thumbBg: '#f5f5f7',
          isStudentPick: Boolean(deal.is_student_relevant),
    }
}

export async function getHomepageDeals(limit = 40) {
    if (!hasSupabaseAdminEnv()) {
          return []
    }

  const supabase = getSupabaseAdmin()
    if (!supabase) {
          return []
    }

  const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit)

  if (error || !data || data.length === 0) {
        return []
  }

  return data.map(mapDealRow)
}
