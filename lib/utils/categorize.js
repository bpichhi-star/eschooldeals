// lib/utils/categorize.js
// Categories match nav tabs: Electronics, Computers, Accessories, Phones, Home, Fashion, Sports
const RULES = [
  { category: 'Computers',   re: /\b(laptop|notebook|macbook|chromebook|desktop|all.?in.?one|aio|mini pc|pc tower|workstation|imac|gaming laptop|gaming pc|ultrabook)\b/i },
  { category: 'Phones',      re: /\b(iphone [0-9]|samsung galaxy [a-z0-9]|google pixel [0-9]|motorola moto|oneplus [0-9]|nothing phone|unlocked phone|unlocked smartphone|unlocked 5g|cell phone|refurbished iphone|refurbished samsung)\b/i },
  { category: 'Accessories', re: /\b(cable|usb-c|lightning cable|hdmi cable|charger|charging pad|power bank|adapter|hub|docking station|mouse|keyboard|webcam|headset|microphone|screen protector|phone case|laptop bag|laptop sleeve|laptop stand|monitor arm|surge protector|memory card|sd card|flash drive|thumb drive|external ssd|external hard drive|earbuds|earphones|airpods|headphones|portable speaker|bluetooth speaker|backpack|school bag)\b/i },
  { category: 'Electronics', re: /\b(tv|television|oled|qled|4k tv|projector|camera|mirrorless|dslr|gopro|drone|speaker|soundbar|home theater|ps5|playstation 5|xbox series|nintendo switch|gaming console|smart home|echo dot|alexa|google home|ring doorbell|nest|security camera|baby monitor|fire stick|apple tv|chromecast|roku|smartwatch|smart watch|fitness tracker|garmin|fitbit|e-reader|kindle|ipad|tablet|streaming device)\b/i },
  { category: 'Home',        re: /\b(vacuum|robot vacuum|air purifier|humidifier|diffuser|space heater|tower fan|iron|steamer|blender|toaster|coffee maker|espresso|keurig|air fryer|instant pot|pressure cooker|microwave|electric kettle|rice cooker|food processor|stand mixer|waffle maker|juicer|lamp|desk lamp|led strip|smart bulb|smart plug|thermostat|smart lock|paper shredder|dehumidifier|carpet cleaner|air conditioner)\b/i },
  { category: 'Fashion',     re: /\b(shirt|tee|t-shirt|jeans|denim|jacket|coat|hoodie|sweatshirt|sweater|dress|skirt|pants|shorts|leggings|activewear|sneaker|shoe|boot|sandal|slipper|hat|beanie|baseball cap|sunglasses|wallet|handbag|purse|crossbody bag|belt|socks|underwear|swimwear|swimsuit|pajama|lounge wear|cardigan|blazer|suit|scarf|gloves|clothing|apparel)\b/i },
  { category: 'Sports',      re: /\b(dumbbell|barbell|kettlebell|weight plate|resistance band|pull.?up bar|squat rack|weight bench|treadmill|stationary bike|elliptical|rowing machine|yoga mat|foam roller|gym bag|protein powder|pre.?workout|creatine|basketball|football|soccer|baseball|tennis|golf club|hockey|boxing|mma|cycling|road bike|mountain bike|bike helmet|skateboard|scooter|hiking|camping tent|fishing rod|kayak|paddleboard|trail shoe|climbing|jump rope|sports bra|compression sleeve|workout equipment)\b/i },
]

export function categorize(title = '', description = '') {
  const text = `${title} ${description}`
  for (const { category, re } of RULES) {
    if (re.test(text)) return category
  }
  return 'General'
}

const CATEGORY_MAP = {
  'Computers': 'Computers', 'Laptops': 'Computers',
  'Cell Phones': 'Phones', 'Smartphones': 'Phones',
  'Computer Accessories': 'Accessories', 'Cell Phone & Tablet Accessories': 'Accessories',
  'Headphones': 'Accessories', 'Power Protection': 'Accessories',
  'Electronics': 'Electronics', 'Speakers & Accessories': 'Electronics',
  'Tablets': 'Electronics', 'TVs': 'Electronics', 'Dash Camera': 'Electronics', 'Gaming': 'Electronics',
  'Home': 'Home', 'Kitchen & Houseware': 'Home', 'Home Improvement': 'Home',
  'Furniture': 'Home', 'Lights': 'Home', 'Household Supplies': 'Home', 'Tools & Hardware': 'Home',
  'Apparels & Accessories': 'Fashion', 'Footwear': 'Fashion', 'Eyewear & Eye Care': 'Fashion',
  'Sports & Outdoors': 'Sports',
}

export function mapExternalCategory(raw = '', title = '') {
  if (CATEGORY_MAP[raw]) return CATEGORY_MAP[raw]
  return categorize(title)
}
