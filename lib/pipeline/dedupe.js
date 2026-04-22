export function buildDealDedupeKey(deal = {}) {
  const merchant = String(deal.merchant || '').trim().toUpperCase()
  const externalId = String(deal.external_id || deal.externalId || '').trim()
  const productUrl = String(deal.product_url || deal.productUrl || '').trim()
  const title = String(deal.title || '').trim().toLowerCase()

  if (merchant && externalId) {
    return `${merchant}::${externalId}`
  }

  if (merchant && productUrl) {
    return `${merchant}::${productUrl}`
  }

  return `${merchant}::${title}`
}

export function dedupeDeals(deals = []) {
  const seen = new Map()

  for (const deal of deals) {
    const key = buildDealDedupeKey(deal)
    const existing = seen.get(key)

    if (!existing) {
      seen.set(key, deal)
      continue
    }

    const existingScore = Number(existing.score || 0)
    const nextScore = Number(deal.score || 0)

    if (nextScore >= existingScore) {
      seen.set(key, deal)
    }
  }

  return [...seen.values()]
}
