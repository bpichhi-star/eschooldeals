export function isValidUrl(value) {
  if (!value || typeof value !== 'string') {
    return false
  }

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function validateDeal(deal = {}) {
  const errors = []

  if (!deal.source_key) {
    errors.push('Missing source_key')
  }

  if (!deal.source_type) {
    errors.push('Missing source_type')
  }

  if (!deal.merchant) {
    errors.push('Missing merchant')
  }

  if (!deal.title) {
    errors.push('Missing title')
  }

  if (!deal.category) {
    errors.push('Missing category')
  }

  if (
    deal.sale_price === null ||
    deal.sale_price === undefined ||
    !Number.isFinite(Number(deal.sale_price)) ||
    Number(deal.sale_price) <= 0
  ) {
    errors.push('Invalid sale_price')
  }

  if (!isValidUrl(deal.product_url)) {
    errors.push('Invalid product_url')
  }

  if (deal.image_url && !isValidUrl(deal.image_url)) {
    errors.push('Invalid image_url')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export function filterValidDeals(deals = []) {
  return deals.filter((deal) => validateDeal(deal).isValid)
}
