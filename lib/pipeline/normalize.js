import { classifyDealCategory } from '@/lib/pipeline/classify'

export function computeDiscountPct(originalPrice, salePrice) {
  if (
    originalPrice === null ||
    originalPrice === undefined ||
    salePrice === null ||
    salePrice === undefined
  ) {
    return null
  }

  const original = Number(originalPrice)
  const sale = Number(salePrice)

  if (!Number.isFinite(original) || !Number.isFinite(sale) || original <= 0) {
    return null
  }

  if (sale >= original) {
    return 0
  }

  return Math.round(((original - sale) / original) * 100)
}

export function normalizeDeal(rawDeal = {}) {
  const merchant = String(rawDeal.merchant || '').trim().toUpperCase()
  const title = String(rawDeal.title || '').trim()

  const originalPrice =
    rawDeal.original_price ?? rawDeal.originalPrice ?? null
  const salePrice = rawDeal.sale_price ?? rawDeal.salePrice ?? null

  const normalized = {
    source_key: String(rawDeal.source_key || '').trim(),
    source_type: String(rawDeal.source_type || 'unknown').trim(),
    external_id: rawDeal.external_id || rawDeal.externalId || null,
    merchant,
    title,
    category: classifyDealCategory({
      ...rawDeal,
      merchant,
      title,
    }),
    original_price:
      originalPrice === null || originalPrice === undefined
        ? null
        : Number(originalPrice),
    sale_price:
      salePrice === null || salePrice === undefined ? null : Number(salePrice),
    discount_pct:
      rawDeal.discount_pct ??
      rawDeal.discountPct ??
      computeDiscountPct(originalPrice, salePrice),
    product_url: String(rawDeal.product_url || rawDeal.productUrl || '').trim(),
    image_url: String(rawDeal.image_url || rawDeal.imageUrl || '').trim() || null,
    currency: String(rawDeal.currency || 'USD').trim().toUpperCase(),
    in_stock:
      rawDeal.in_stock === undefined ? true : Boolean(rawDeal.in_stock),
    is_student_relevant: Boolean(
      rawDeal.is_student_relevant ?? rawDeal.isStudentRelevant ?? false
    ),
    is_featured: Boolean(rawDeal.is_featured ?? rawDeal.isFeatured ?? false),
    fetched_at: rawDeal.fetched_at || new Date().toISOString(),
    expires_at: rawDeal.expires_at || null,
  }

  return normalized
}
