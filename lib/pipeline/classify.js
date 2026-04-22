const CATEGORY_RULES = [
  {
    category: 'Phones',
    terms: ['iphone', 'galaxy', 'pixel', 'magsafe', 'phone', 'smartphone', 'airpods'],
  },
  {
    category: 'Computers',
    terms: [
      'laptop',
      'notebook',
      'desktop',
      'monitor',
      'tablet',
      'chromebook',
      'macbook',
      'ipad',
    ],
  },
  {
    category: 'Kitchen',
    terms: [
      'air fryer',
      'instant pot',
      'cooker',
      'blender',
      'coffee',
      'espresso',
      'toaster',
      'ninja',
      'microwave',
    ],
  },
  {
    category: 'Home',
    terms: [
      'vacuum',
      'furniture',
      'mattress',
      'light',
      'security',
      'cleaner',
      'storage',
      'bedding',
      'lamp',
    ],
  },
  {
    category: 'Fashion',
    terms: [
      'shoe',
      'jacket',
      'hoodie',
      'shirt',
      'pants',
      'dress',
      'sneaker',
      'apparel',
      'jeans',
      'coat',
    ],
  },
  {
    category: 'Sports',
    terms: [
      'bike',
      'fitness',
      'outdoor',
      'camp',
      'hiking',
      'running',
      'yoga',
      'gym',
    ],
  },
  {
    category: 'Textbooks',
    terms: ['textbook', 'study guide', 'education', 'coursebook'],
  },
  {
    category: 'Software',
    terms: ['software', 'license', 'subscription', 'antivirus', 'vpn'],
  },
  {
    category: 'Dorm',
    terms: ['dorm', 'mini fridge', 'storage bin', 'bedding', 'desk organizer'],
  },
  {
    category: 'Office',
    terms: ['printer', 'paper', 'keyboard', 'mouse', 'office', 'desk', 'chair'],
  },
  {
    category: 'Beauty',
    terms: ['beauty', 'skincare', 'makeup', 'fragrance', 'serum', 'cleanser'],
  },
  {
    category: 'Automotive',
    terms: ['car charger', 'dash cam', 'automotive', 'tire', 'car mount'],
  },
  {
    category: 'Tools',
    terms: ['drill', 'tool', 'driver', 'saw', 'dewalt', 'milwaukee', 'wrench'],
  },
  {
    category: 'Pets',
    terms: ['pet', 'dog', 'cat', 'litter', 'leash', 'pet food'],
  },
  {
    category: 'Food',
    terms: ['snack', 'coffee beans', 'protein', 'food', 'cereal', 'meal'],
  },
  {
    category: 'Electronics',
    terms: [
      'headphones',
      'speaker',
      'tv',
      'camera',
      'drone',
      'charger',
      'power bank',
      'projector',
      'gaming',
      'earbuds',
    ],
  },
]

export function classifyDealCategory(rawDeal = {}) {
  if (rawDeal.category) {
    return String(rawDeal.category).trim()
  }

  const haystack = `${rawDeal.title || ''} ${rawDeal.merchant || ''}`.toLowerCase()

  for (const rule of CATEGORY_RULES) {
    if (rule.terms.some((term) => haystack.includes(term))) {
      return rule.category
    }
  }

  return 'Today'
}
