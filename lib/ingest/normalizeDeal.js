import { classifyCategory } from '@/lib/ingest/classifyCategory'

export function computeDiscountPct(originalPrice, salePrice) {
  if (!originalPrice || !salePrice || originalPrice <= salePrice) {
    return null
  }

  return Math.round(((originalPrice - salePrice) / originalPrice) * 100)
}

export function normalizeDeal(rawDeal) {
  const salePrice = Number(rawDeal.sale_price ?? rawDeal.salePrice ?? 0)
  const originalPriceValue = rawDeal.original_price ?? rawDeal.originalPrice
  const originalPrice =
    originalPriceValue === null || originalPriceValue === undefined
      ? null
      : Number(originalPriceValue)

  const normalized = {
    source_key: rawDeal.source_key,
    merchant: rawDeal.merchant,
    source_type: rawDeal.source_type || 'scrape',
    external_id: rawDeal.external_id || null,
    title: rawDeal.title,
    category: classifyCategory(rawDeal),
    original_price: Number.isFinite(originalPrice) ? originalPrice : null,
    sale_price: salePrice,
    discount_pct:
      rawDeal.discount_pct ?? computeDiscountPct(originalPrice, salePrice),
    product_url: rawDeal.product_url || rawDeal.productUrl,
    image_url: rawDeal.image_url || rawDeal.imageUrl || null,
    currency: rawDeal.currency || 'USD',
    in_stock: rawDeal.in_stock ?? true,
    is_student_relevant: rawDeal.is_student_relevant ?? false,
    fetched_at: rawDeal.fetched_at || new Date().toISOString(),
    expires_at: rawDeal.expires_at || null,
  }

  return normalized
}
