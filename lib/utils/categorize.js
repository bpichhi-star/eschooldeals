// lib/utils/categorize.js
// Categories align with nav tabs: Electronics, Computers, Accessories, Phones, Home, Fashion, Sports
// General is the fallback (shows in Today only)

const RULES = [
  // Computers first — most specific
  { category: 'Computers',    re: /\b(laptop|notebook|macbook|chromebook|desktop|all.?in.?one|aio|mini pc|pc tower|workstation|imac|gaming laptop|gaming pc|ultrabook)\b/i },

  // Phones — unlocked handsets
  { category: 'Phones',       re: /\b(iphone [0-9]|samsung galaxy [a-z0-9]|google pixel [0-9]|motorola moto|oneplus [0-9]|nothing phone|unlocked phone|unlocked smartphone|unlocked 5g|cell phone|refurbished iphone|refurbished samsung)\b/i },

  // Accessories — cables, peripherals, cases, audio accessories
  { category: 'Accessories',  re: /\b(cable|usb-c|usb c|lightning cable|hdmi cable|charger|charging pad|power bank|adapter|hub|docking station|mouse|keyboard|webcam|headset|microphone|screen protector|phone case|laptop bag|laptop sleeve|laptop stand|monitor arm|surge protector|extension cord|memory card|sd card|flash drive|thumb drive|external ssd|external hard drive|earbuds|earphones|airpods|headphones|wired earphone|portable speaker|bluetooth speaker|backpack|school bag)\b/i },

  // Electronics — TVs, gaming consoles, cameras, smart home, wearables, tablets
  { category: 'Electronics',  re: /\b(tv|television|oled|qled|4k tv|projector|camera|mirrorless|dslr|gopro|action cam|drone|speaker|soundbar|home theater|ps5|playstation 5|xbox series|nintendo switch|gaming console|smart home|echo dot|alexa|google home|ring doorbell|nest|security camera|baby monitor|fire stick|apple tv|chromeuch|roku|smartwatch|smart watch|fitness tracker|garmin|fitbit|e-reader|kindle|ipad|tablet|streaming device|blu.?ray player)\b/i },

  // Home — small appliances, kitchen appliances, home comfort
  { category: 'Home',         re: /\b(vacuum|robot vacuum|air purifier|humidifier|diffuser|space heater|tower fan|iron|garment steamer|blender|toaster|coffee maker|espresso machine|keurig|air fryer|instant pot|pressure cooker|microwave|electric kettle|rice cooker|food processor|stand mixer|waffle maker|juicer|lamp|desk lamp|led strip|smart bulb|smart plug|thermostat|smart lock|paper shredder|dehumidifier|carpet cleaner|air conditioner)\b/i },

  // Fashion — clothing, shoes, accessories
  { category: 'Fashion',      re: /\b(shirt|tee|t-shirt|jeans|denim|jacket|coat|hoodie|sweatshirt|sweater|dress|skirt|pants|shorts|leggings|activewear|sneaker|shoe|boot|sandal|slipper|hat|beanie|baseball cap|sunglasses|wallet|handbag|purse|crossbody bag|belt|socks|underwear|swimwear|swimsuit|pajama|lounge wear|cardigan|blazer|suit|scarf|gloves|clothing|apparel)\b/i },

  // Sports — gym equipment, sports gear, outdoor
  { category: 'Sports',       re: /\b(dumbbell|barbell|kettlebell|weight plate|resistance band|pull.?up bar|squat rack|weight bench|treadmill|stationary bike|elliptical|rowing machine|yoga mat|foam roller|gym bag|protein powder|pre.?workout|creatine|basketball|football|soccer|baseball|tennis|golf club|hockey|boxing|mma|cycling|road bike|mountain bike|bike helmet|skateboard|scooter|hiking|camping tent|fishing rod|kayak|paddleboard|trail shoe|climbing|jump rope|sports bra|compression sleeve|workout equipment)\b/i },
]

export function categorize(title = '', description = '') {
  const text = `${title} ${description}`
  for (const { category, re } of RULES) {
    if (re.test(text)) return category
  }
  return 'General'
}

// Maps external feed category strings to our internal categories
const CATEGORY_MAP = {
  // Computers
  'Computers': 'Computers', 'Laptops': 'Computers',
  // Phones
  'Cell Phones': 'Phones', 'Smartphones': 'Phones',
  // Accessories
  'Computer Accessories': 'Accessories', 'Cell Phone & Tablet Accessories': 'Accessories',
  'Headphones': 'Accessories', 'Power Protection': 'Accessories',
  // Electronics
  'Electronics': 'Electronics', 'Speakers & Accessories': 'Electronics',
  'Tablets': 'Electronics', 'TVs': 'Electronics', 'Dash Camera': 'Electronics',
  'Gaming': 'Electronics',
  // Home
  'Home': 'Home', 'Kitchen & Houseware': 'Home', 'Home Improvement': 'Home',
  'Furniture': 'Home', 'Lights': 'Home', 'Household Supplies': 'Home',
  'Tools & Hardware': 'Home',
  // Fashion
  'Apparels & Accessories': 'Fashion', 'Footwear': 'Fashion',
  'Eyewear & Eye Care': 'Fashion',
  // Sports
  'Sports & Outdoors': 'Sports',
}

export function mapExternalCategory(raw = '', title = '') {
  if (CATEGORY_MAP[raw]) return CATEGORY_MAP[raw]
  return categorize(title)
}
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
