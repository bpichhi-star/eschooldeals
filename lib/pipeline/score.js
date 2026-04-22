const TRUSTED_MERCHANTS = [
  'AMAZON',
  'WALMART',
  'TARGET',
  'BEST BUY',
  'EBAY',
  'WAYFAIR',
  'REI',
  "MACY'S",
  'ADIDAS',
]

const STUDENT_CATEGORIES = [
  'Electronics',
  'Computers',
  'Phones',
  'Dorm',
  'Office',
  'Textbooks',
  'Software',
]

export function scoreDeal(deal = {}) {
  let score = 0

  const discountPct = Number(deal.discount_pct || 0)

  if (Number.isFinite(discountPct) && discountPct > 0) {
    score += discountPct
  }

  if (deal.in_stock) {
    score += 10
  }

  if (deal.is_student_relevant) {
    score += 15
  }

  if (STUDENT_CATEGORIES.includes(deal.category)) {
    score += 10
  }

  if (TRUSTED_MERCHANTS.includes(deal.merchant)) {
    score += 5
  }

  if (deal.is_featured) {
    score += 8
  }

  return score
}
