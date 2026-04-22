export function dedupeDeals(deals) {
  const seen = new Map()

  for (const deal of deals) {
    const key = `${deal.merchant}::${deal.external_id || deal.product_url || deal.title}`
    const existing = seen.get(key)

    if (!existing) {
      seen.set(key, deal)
      continue
    }

    const existingScore = existing.score || 0
    const nextScore = deal.score || 0

    if (nextScore >= existingScore) {
      seen.set(key, deal)
    }
  }

  return [...seen.values()]
}
