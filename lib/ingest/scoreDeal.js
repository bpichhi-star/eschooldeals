export function scoreDeal(deal) {
  let score = 0

  if (deal.discount_pct) score += deal.discount_pct
  if (deal.in_stock) score += 10
  if (deal.is_student_relevant) score += 15

  if (
    ['Electronics', 'Computers', 'Phones', 'Dorm', 'Office', 'Textbooks'].includes(
      deal.category
    )
  ) {
    score += 10
  }

  if (['AMAZON', 'WALMART', 'TARGET', 'BEST BUY', 'EBAY'].includes(deal.merchant)) {
    score += 5
  }

  return score
}
