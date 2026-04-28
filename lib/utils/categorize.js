// lib/utils/categorize.js
// Rule ORDER matters — first match wins.
// Accessories must come before Computers and Phones so that
// "Laptop Stand", "iPhone Case", etc. don't get misclassified.

const RULES = [
  // ── 1. ACCESSORIES ──────────────────────────────────────────────────────────
  // Checked FIRST to catch phone/laptop accessories before Phones or Computers rules fire.
  // Does NOT include headphones/earbuds/speakers — those live in Electronics.
  {
    category: 'Accessories',
    re: /\b(phone case|iphone case|galaxy case|samsung case|phone cover|phone holder|phone mount|phone stand|phone grip|pop socket|screen protector|tempered glass|privacy screen|phone strap|crossbody phone|laptop case|laptop stand|laptop riser|laptop tray|laptop sleeve|laptop bag|laptop skin|laptop cooler|notebook sleeve|notebook bag|usb.?c hub|usb hub|docking station|kvm switch|usb.?c cable|usb.?a cable|lightning cable|magsafe cable|hdmi cable|displayport cable|ethernet cable|thunderbolt cable|aux cable|audio cable|charging cable|charging pad|wireless charger|magsafe charger|wall charger|car charger|travel charger|power bank|portable charger|battery pack|power strip|surge protector|extension cord|monitor stand|monitor mount|monitor arm|monitor riser|keyboard cover|keyboard cleaner|keycap|wrist rest|mouse pad|desk mat|webcam cover|privacy cover|cable management|cable organizer|cable clip|cable box|laptop lock|security cable|memory card|sd card|flash drive|usb drive|thumb drive|hard drive enclosure|pc case|computer case|gaming chair|desk organizer|backpack|school bag|messenger bag|tote bag|sling bag|computer bag|mouse|keyboard|webcam|microphone|mic stand|pop filter|boom arm|ring light|selfie stick|tripod|gimbal|drone accessory|camera bag|camera strap|lens cap|lens filter|battery grip|action cam mount|smart home hub|universal remote|streaming stick|adapter|dongle|converter|splitter|switch.?hdmi)\b/i
  },

  // ── 2. COMPUTERS ─────────────────────────────────────────────────────────────
  // Actual computing devices only — accessories above catch laptop bags, stands, etc.
  {
    category: 'Computers',
    re: /\b(laptop|notebook|macbook|chromebook|desktop pc|desktop computer|all.?in.?one pc|aio pc|mini pc|pc tower|workstation pc|imac|gaming laptop|gaming pc|ultrabook|nuc|thin client)\b/i
  },

  // ── 3. PHONES ────────────────────────────────────────────────────────────────
  // Actual handsets only — phone accessories are caught above.
  {
    category: 'Phones',
    re: /\b(iphone \d|iphone (pro|plus|max|mini)|samsung galaxy [a-z0-9]|google pixel \d|motorola (moto|edge|razr)|oneplus \d|nothing phone|unlocked (phone|smartphone|5g phone)|cell phone|refurbished iphone|refurbished samsung|refurbished pixel|android phone|5g smartphone)\b/i
  },

  // ── 4. ELECTRONICS ───────────────────────────────────────────────────────────
  // Headphones, earbuds, speakers, and all consumer electronics live here.
  {
    category: 'Electronics',
    re: /\b(headphones|over.?ear headphones|on.?ear headphones|noise.?cancelling headphones|earbuds|earphones|in.?ear|true wireless|airpods|galaxy buds|beats (studio|solo|fit|flex|powerbeats)|bose (quietcomfort|soundsport)|jabra|portable speaker|bluetooth speaker|soundbar|home theater|subwoofer|turntable|record player|tv|television|oled|qled|4k tv|8k tv|smart tv|projector|camera|mirrorless|dslr|gopro|action camera|drone|ps5|playstation 5|xbox series|nintendo switch|gaming console|steam deck|handheld console|smart home|echo dot|alexa|google home|ring doorbell|nest|security camera|baby monitor|fire stick|apple tv|chromecast|roku|streaming device|smartwatch|smart watch|apple watch|galaxy watch|fitness tracker|garmin watch|fitbit|whoop|e-reader|kindle|tablet|ipad|graphic tablet|drawing tablet|monitor|gaming monitor|curved monitor|ultrawide|4k monitor|portable monitor|e.?ink display|calculator|graphing calculator|walkie.?talkie|ham radio|digital camera|instant camera|polaroid)\b/i
  },

  // ── 5. HOME ──────────────────────────────────────────────────────────────────
  {
    category: 'Home',
    re: /\b(vacuum|robot vacuum|air purifier|humidifier|diffuser|space heater|tower fan|ceiling fan|iron|steamer|blender|toaster|coffee maker|espresso machine|keurig|nespresso|air fryer|instant pot|pressure cooker|microwave|electric kettle|rice cooker|food processor|stand mixer|waffle maker|juicer|lamp|desk lamp|floor lamp|led strip|smart bulb|smart plug|thermostat|smart lock|doorbell camera|paper shredder|dehumidifier|carpet cleaner|air conditioner|mini fridge|wine fridge|chest freezer|dishwasher|washer|dryer|mattress|bed frame|pillow|comforter|duvet|bed sheet|blanket|towel|shower curtain|shower head|bath mat|storage bin|shelf|bookcase|dresser|nightstand|sofa|couch|recliner|office chair|standing desk|desk|bookshelf|picture frame|mirror|rug|curtain|blinds|laundry hamper|drying rack|mop|broom|trash can|kitchen organizer|drawer organizer|shower caddy|over.?door organizer|hangers|storage basket|bed riser|cable box|tv stand|entertainment center)\b/i
  },

  // ── 6. FASHION ───────────────────────────────────────────────────────────────
  {
    category: 'Fashion',
    re: /\b(shirt|tee|t-shirt|polo|henley|jeans|denim|chinos|trousers|jacket|coat|parka|hoodie|sweatshirt|sweater|cardigan|blazer|suit|vest|dress|skirt|romper|jumpsuit|pants|shorts|leggings|tights|activewear|athletic wear|sneakers|running shoes|dress shoes|loafers|boots|sandals|slippers|slides|cleats|hat|beanie|baseball cap|snapback|sunglasses|glasses frames|watch|jewelry|necklace|bracelet|earrings|ring|wallet|handbag|purse|crossbody bag|clutch|belt|socks|underwear|bra|sports bra|swimwear|swimsuit|bikini|trunks|pajama|lounge wear|robe|scarf|gloves|mittens|clothing|apparel|fashion)\b/i
  },

  // ── 7. SPORTS ────────────────────────────────────────────────────────────────
  {
    category: 'Sports',
    re: /\b(dumbbell|barbell|kettlebell|weight plate|weight set|resistance band|pull.?up bar|squat rack|weight bench|treadmill|stationary bike|peloton|elliptical|rowing machine|yoga mat|foam roller|gym bag|protein powder|whey protein|pre.?workout|creatine|bcaa|basketball|football|soccer ball|baseball|tennis racket|golf club|golf bag|hockey stick|boxing gloves|mma gloves|cycling shoes|road bike|mountain bike|gravel bike|bike helmet|skateboard|longboard|scooter|hiking boots|hiking pole|camping tent|sleeping bag|camping stove|fishing rod|fishing reel|kayak|paddleboard|surfboard|ski|snowboard|climbing harness|jump rope|resistance tube|ab roller|sports bra|compression sleeve|shin guard|batting glove|workout equipment|home gym|squat stand)\b/i
  },
]

export function categorize(title = '', description = '') {
  const text = title + ' ' + description
  for (const { category, re } of RULES) {
    if (re.test(text)) return category
  }
  return 'General'
}

// Maps raw external feed category labels → our categories
const CATEGORY_MAP = {
  'Computers':                       'Computers',
  'Laptops':                         'Computers',
  'Cell Phones':                     'Phones',
  'Smartphones':                     'Phones',
  'Computer Accessories':            'Accessories',
  'Cell Phone & Tablet Accessories': 'Accessories',
  'Phone Accessories':               'Accessories',
  'Cables & Adapters':               'Accessories',
  'Headphones':                      'Electronics',
  'Speakers':                        'Electronics',
  'Earbuds':                         'Electronics',
  'Audio':                           'Electronics',
  'Power Protection':                'Accessories',
  'Electronics':                     'Electronics',
  'Speakers & Accessories':          'Electronics',
  'Tablets':                         'Electronics',
  'TVs':                             'Electronics',
  'Monitors':                        'Electronics',
  'Dash Camera':                     'Electronics',
  'Gaming':                          'Electronics',
  'Wearables':                       'Electronics',
  'Smart Home':                      'Electronics',
  'Home':                            'Home',
  'Kitchen & Houseware':             'Home',
  'Home Improvement':                'Home',
  'Furniture':                       'Home',
  'Lights':                          'Home',
  'Household Supplies':              'Home',
  'Tools & Hardware':                'Home',
  'Apparels & Accessories':          'Fashion',
  'Footwear':                        'Fashion',
  'Eyewear & Eye Care':              'Fashion',
  'Sports & Outdoors':               'Sports',
}

export function mapExternalCategory(raw = '', title = '') {
  if (CATEGORY_MAP[raw]) return CATEGORY_MAP[raw]
  return categorize(title)
}
