// lib/utils/categorize.js
const RULES = [
  { category: 'Computers',    re: /\b(laptop|notebook|macbook|chromebook|desktop|mini pc|pc tower|all.?in.?one|workstation|imac|nuc|ssd|hard drive|ram|ddr[0-9]|cpu|processor|ryzen|intel core|motherboard)\b/i },
  { category: 'Electronics',  re: /\b(headphone|earbud|airpod|monitor|speaker|charger|charging|cable|usb|hub|webcam|router|wifi|switch|ethernet|tv|television|camera|drone|smartwatch|tablet|kindle|ipad|projector|printer|scanner|flash drive|power bank|dash cam|carplay|bluetooth)\b/i },
  { category: 'Phones',       re: /\b(iphone|samsung galaxy|google pixel|motorola moto|smartphone|phone case|phone stand|phone holder|cell phone|sim card|screen protector)\b/i },
  { category: 'Gaming',       re: /\b(gaming|playstation|xbox|nintendo|ps5|ps4|switch|steam|gpu|rtx|radeon|geforce|game|controller|keyboard mouse)\b/i },
  { category: 'Kitchen',      re: /\b(blender|toaster|microwave|coffee maker|espresso|air fryer|instant pot|pressure cooker|cookware|pan|pot|knife|food processor|kettle|mixer|wok|rice cooker|waffle|juicer)\b/i },
  { category: 'Home',         re: /\b(vacuum|robot vacuum|lamp|light bulb|furniture|sofa|couch|bed frame|mattress|pillow|blanket|chair|desk|shelf|storage|organizer|smart home|thermostat|doorbell|mirror|rug|curtain|shower|toilet|drill|saw|tool|wrench|plier|screwdriver)\b/i },
  { category: 'Fashion',      re: /\b(shoe|sneaker|boot|sandal|shirt|tee|jeans|jacket|coat|hoodie|sweater|dress|watch|sunglasses|wallet|handbag|purse|pants|shorts|sock|underwear|belt|hat|beanie|gloves|scarf|pajama|sport coat|blazer)\b/i },
  { category: 'Sports',       re: /\b(yoga|fitness|dumbbell|barbell|kettlebell|weight plate|treadmill|bike|cycling|tennis|basketball|football|soccer|golf|camping|hiking|outdoor|kayak|fishing|hunting|archery|swim|running|athletic)\b/i },
  { category: 'Travel',       re: /\b(luggage|suitcase|carry.?on|travel bag|duffel|backpack|passport|travel adapter|packing cube|neck pillow)\b/i },
  { category: 'Toys',         re: /\b(lego|toy|puzzle|board game|action figure|doll|plush|stuffed animal|nerf|kids|playset|children|baby|infant|toddler)\b/i },
  { category: 'Beauty',       re: /\b(sunscreen|moisturizer|serum|mascara|lipstick|foundation|shampoo|conditioner|hair|skincare|lotion|cream|gel|face wash|perfume|cologne|razor|electric shaver|nail)\b/i },
  { category: 'Health',       re: /\b(vitamin|supplement|protein|probiotic|melatonin|first aid|blood pressure|thermometer|pill|medicine|health|wellness|insole|orthotic|hearing|cpap)\b/i },
  { category: 'Food',         re: /\b(snack|cookie|candy|coffee|tea|juice|protein bar|cereal|chips|chocolate|nuts|organic|keto|gluten.?free)\b/i },
  { category: 'Auto',         re: /\b(car|vehicle|auto|tire|oil filter|air filter|wiper|seat cover|floor mat|jump starter|car charger|windshield|dashcam|carplay|obd)\b/i },
  { category: 'Garden',       re: /\b(garden|plant|seed|lawn|grass|mower|trimmer|pruner|shovel|rake|fertilizer|compost|pot|planter|hose|sprinkler|weed)\b/i },
  { category: 'Media',        re: /\b(blu.?ray|dvd|4k uhd|steelbook|movie|film|book|ebook|audiobook|vinyl|record|game key|steam key)\b/i },
]

export function categorize(title = '', description = '') {
  const text = `${title} ${description}`
  for (const { category, re } of RULES) {
    if (re.test(text)) return category
  }
  return 'General'
}

const CATEGORY_MAP = {
  'Apparels & Accessories': 'Fashion', 'Footwear': 'Fashion', 'Eyewear & Eye Care': 'Fashion',
  'Speakers & Accessories': 'Electronics', 'Cell Phone & Tablet Accessories': 'Electronics',
  'Computer Accessories': 'Electronics', 'Headphones': 'Electronics', 'Dash Camera': 'Electronics',
  'Auto Parts & Accessories': 'Auto', 'Furniture': 'Home', 'Home Improvement': 'Home',
  'Lights': 'Home', 'Household Supplies': 'Home', 'Garden Accessories': 'Garden',
  'Kitchen & Houseware': 'Kitchen', 'Tools & Hardware': 'Home', 'Power Protection': 'Electronics',
  'Computers': 'Computers', 'Laptops': 'Computers', 'Tablets': 'Electronics', 'TVs': 'Electronics',
  'Sports & Outdoors': 'Sports', 'Toys & Games': 'Toys', 'Health & Beauty': 'Health', 'Food & Grocery': 'Food',
}

export function mapExternalCategory(raw = '', title = '') {
  if (CATEGORY_MAP[raw]) return CATEGORY_MAP[raw]
  return categorize(title)
}
