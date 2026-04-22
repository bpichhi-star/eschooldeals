const CATEGORY_RULES = [
  {
    category: 'Phones',
    terms: ['iphone', 'galaxy', 'pixel', 'magsafe', 'phone', 'smartphone'],
  },
  {
    category: 'Computers',
    terms: ['laptop', 'notebook', 'desktop', 'monitor', 'tablet', 'chromebook'],
  },
  {
    category: 'Kitchen',
    terms: ['air fryer', 'instant pot', 'cooker', 'blender', 'coffee', 'ninja'],
  },
  {
    category: 'Home',
    terms: ['vacuum', 'furniture', 'mattress', 'light', 'security', 'cleaner'],
  },
  {
    category: 'Fashion',
    terms: ['shoe', 'jacket', 'hoodie', 'shirt', 'pants', 'dress', 'sneaker'],
  },
  {
    category: 'Sports',
    terms: ['bike', 'fitness', 'outdoor', 'camp', 'hiking', 'running'],
  },
  {
    category: 'Textbooks',
    terms: ['textbook', 'study guide', 'education'],
  },
  {
    category: 'Software',
    terms: ['software', 'license', 'subscription', 'antivirus'],
  },
  {
    category: 'Dorm',
    terms: ['dorm', 'mini fridge', 'storage bin', 'bedding'],
  },
  {
    category: 'Office',
    terms: ['printer', 'paper', 'keyboard', 'mouse', 'office', 'desk'],
  },
  {
    category: 'Beauty',
    terms: ['beauty', 'skincare', 'makeup', 'fragrance'],
  },
  {
    category: 'Automotive',
    terms: ['car charger', 'dash cam', 'automotive', 'tire'],
  },
  {
    category: 'Tools',
    terms: ['drill', 'tool', 'driver', 'saw', 'dewalt'],
  },
  {
    category: 'Pets',
    terms: ['pet', 'dog', 'cat', 'litter', 'leash'],
  },
  {
    category: 'Food',
    terms: ['snack', 'coffee beans', 'protein', 'food'],
  },
]

export function classifyCategory(rawDeal) {
  if (rawDeal.category) return rawDeal.category

  const haystack = `${rawDeal.title || ''} ${rawDeal.merchant || ''}`.toLowerCase()

  for (const rule of CATEGORY_RULES) {
    if (rule.terms.some((term) => haystack.includes(term))) {
      return rule.category
    }
  }

  return 'Today'
}
