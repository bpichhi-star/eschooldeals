// lib/utils/categorize.js
//
// Single source of truth for deal → category routing.
// Used by every feed parser AND the /api/admin/recategorize endpoint.
//
// Categories (matches site nav: Today/Electronics/Computers/Accessories/Phones/Home/Fashion/Sports):
//   Electronics  — TVs, speakers/soundbars, cameras, gaming consoles, smartwatches,
//                  monitors, e-readers, smart home — anything electronic that isn't
//                  a computing device, headphones, or a phone
//   Computers    — laptops, desktops, all-in-ones, tablets, iPads
//   Accessories  — headphones, earbuds, AirPods, cables, docking stations, hubs,
//                  chargers, mice, keyboards, webcams, mics, cases, mounts, drives
//   Phones       — cell phones / smartphones only (handsets)
//   Home         — furniture, kitchen appliances, lighting, bedding, storage
//   Fashion      — clothing, footwear (non-athletic), accessories like bags/watches
//   Sports       — athletic equipment, athletic shoes, outdoor gear, supplements
//
// RULE ORDER MATTERS. First match wins. Accessories is checked BEFORE Computers/
// Phones/Electronics so that "iPad case", "laptop stand", "phone charger",
// "headphone case" don't get routed to the device category.

const RULES = [
  // ── 1. ACCESSORIES ──────────────────────────────────────────────────────────
  // Checked first so device cases/stands/cables don't fall into device categories.
  // INCLUDES headphones/earbuds/AirPods (not Electronics) per product spec.
  {
    category: 'Accessories',
    re: /\b(?:headphones?|over.?ear headphones?|on.?ear headphones?|noise.?cancelling headphones?|earbuds?|earphones?|in.?ear (?:headphones?|monitors?)|true wireless|airpods|galaxy buds|beats (?:studio|solo|fit|flex|powerbeats|pill)|bose (?:quietcomfort|soundsport|sport earbuds)|jabra (?:elite|talk)|jbl (?:tune|live|reflect|free|endurance)|sony wf-|sony wh-|anker soundcore|sennheiser (?:momentum|cx|hd)|skullcandy (?:indy|sesh|jib|crusher)|pixel buds|nothing ear|moondrop|raycon|gaming headset|wired headset|bluetooth headset|phone case|iphone case|galaxy case|samsung case|pixel case|phone cover|phone holder|phone mount|phone stand|phone grip|pop ?socket|screen protector|tempered glass|privacy screen|phone strap|crossbody phone|tablet case|ipad case|kindle case|e-?reader case|laptop case|laptop stand|laptop riser|laptop tray|laptop sleeve|laptop bag|laptop skin|laptop cooler|notebook sleeve|notebook bag|usb.?c hub|usb hub|docking station|kvm switch|usb.?c cable|usb.?a cable|lightning cable|magsafe cable|hdmi cable|displayport cable|ethernet cable|thunderbolt cable|aux cable|audio cable|charging cable|charging pad|wireless charger|magsafe charger|wall charger|car charger|travel charger|power bank|portable charger|battery pack|power strip|surge protector|extension cord|monitor stand|monitor mount|monitor arm|monitor riser|keyboard cover|keyboard cleaner|keycap|wrist rest|mouse pad|desk mat|webcam cover|privacy cover|cable management|cable organizer|cable clip|cable box|laptop lock|security cable|memory card|sd card|micro ?sd|flash drive|usb drive|thumb drive|hard drive enclosure|external (?:hard drive|ssd|hdd)|portable ssd|portable (?:hard drive|hdd)|pc case|computer case|gaming chair|desk organizer|backpack|school bag|messenger bag|tote bag|sling bag|computer bag|mouse|keyboard|webcam|microphone|mic stand|pop filter|boom arm|ring light|selfie stick|tripod|gimbal|drone accessory|camera bag|camera strap|lens cap|lens filter|battery grip|action cam mount|smart home hub|universal remote|streaming stick|adapter|dongle|converter|splitter|graphic tablet|drawing tablet|stylus|apple pencil|s.?pen)\b/i
  },

  // ── 2. COMPUTERS ─────────────────────────────────────────────────────────────
  // Computing devices only. INCLUDES tablets/iPads per product spec.
  // Accessories above catches "tablet case", "ipad case", "graphic tablet",
  // "laptop stand", etc., so those don't end up here.
  {
    category: 'Computers',
    re: /\b(?:laptop|notebook (?:computer|pc)|macbook|chromebook|desktop pc|desktop computer|all.?in.?one pc|aio pc|mini pc|pc tower|workstation pc|imac|gaming laptop|gaming pc|gaming desktop|ultrabook|nuc|thin client|tablet|ipad|ipad pro|ipad air|ipad mini|galaxy tab|surface (?:pro|laptop|book|go)|fire tablet|kindle fire|android tablet|windows tablet|2.?in.?1 (?:laptop|tablet))\b/i
  },

  // ── 3. PHONES ────────────────────────────────────────────────────────────────
  // Handsets only — phone accessories are caught above.
  {
    category: 'Phones',
    re: /\b(?:iphone \d+|iphone (?:pro|plus|max|mini|se)|samsung galaxy (?:s\d+|note|z|a\d+)|google pixel \d+|motorola (?:moto|edge|razr)|oneplus \d+|nothing phone|unlocked (?:phone|smartphone|5g phone)|cell phone|cellphone|refurbished iphone|refurbished samsung|refurbished pixel|android phone|5g smartphone|smartphone (?:unlocked|t.?mobile|verizon|at.?t))\b/i
  },

  // ── 4. ELECTRONICS ───────────────────────────────────────────────────────────
  // TVs, speakers, cameras, gaming consoles, smartwatches, monitors, smart home —
  // anything electronic that isn't a computing device, headphones, or a phone.
  {
    category: 'Electronics',
    re: /\b(?:portable speaker|bluetooth speaker|wireless speaker|smart speaker|soundbar|home theater|surround sound|subwoofer|av receiver|stereo receiver|turntable|record player|tv|television|oled|qled|4k tv|8k tv|smart tv|projector|camera|mirrorless|dslr|gopro|action camera|drone|ps5|playstation 5|xbox series|nintendo switch|gaming console|steam deck|handheld console|smart home|echo dot|echo show|alexa device|google home|google nest|ring doorbell|nest (?:thermostat|cam|hub)|security camera|baby monitor|fire stick|apple tv|chromecast|roku|streaming device|smartwatch|smart watch|apple watch|galaxy watch|fitness tracker|garmin watch|fitbit|whoop|oura ring|e.?reader|kindle(?! fire)|kobo|monitor|gaming monitor|curved monitor|ultrawide|4k monitor|portable monitor|e.?ink display|calculator|graphing calculator|walkie.?talkie|ham radio|digital camera|instant camera|polaroid|dash cam|dashcam)\b/i
  },

  // ── 5. HOME ──────────────────────────────────────────────────────────────────
  {
    category: 'Home',
    re: /\b(?:vacuum|robot vacuum|air purifier|humidifier|diffuser|space heater|ceramic heater|tower fan|ceiling fan|iron|steamer|blender|toaster|toaster oven|coffee maker|coffee brewer|espresso machine|keurig|nespresso|air fryer|instant pot|pressure cooker|microwave|electric kettle|rice cooker|food processor|stand mixer|waffle maker|juicer|cooktop|electric range|gas range|electric oven|gas oven|wall oven|range hood|refrigerator|top.?freezer refrigerator|french door refrigerator|freezer|chest freezer|beverage cooler|lamp|desk lamp|floor lamp|led strip|smart bulb|smart plug|thermostat|smart lock|doorbell camera|paper shredder|dehumidifier|carpet cleaner|air conditioner|mini fridge|wine fridge|dishwasher|washer|dryer|mattress|bed frame|pillow|comforter|duvet|bed sheet|blanket|towel|shower curtain|shower head|bath mat|storage bin|shelf|bookcase|dresser|nightstand|sofa|couch|recliner|office chair|standing desk|desk(?! lamp| mat| organizer)|bookshelf|picture frame|mirror|rug|curtain|blinds|laundry hamper|laundry basket|drying rack|mop|broom|trash can|kitchen organizer|drawer organizer|shower caddy|over.?door organizer|hangers|storage basket|bed riser|tv stand|entertainment center)\b/i
  },

  // ── 6. FASHION ───────────────────────────────────────────────────────────────
  {
    category: 'Fashion',
    re: /\b(?:shirt|tee|t-shirt|polo|henley|jeans|denim|chinos|trousers|jacket|coat|parka|hoodie|sweatshirt|sweater|cardigan|blazer|suit|vest|dress|skirt|romper|jumpsuit|pants|shorts|leggings|tights|activewear|athletic wear|dress shoes|loafers|boots|sandals|slippers|slides|hat|beanie|baseball cap|snapback|sunglasses|glasses frames|wristwatch|jewelry|necklace|bracelet|earrings|ring|wallet|handbag|purse|crossbody bag|clutch|belt|socks|underwear|bra|sports bra|swimwear|swimsuit|bikini|trunks|pajama|lounge wear|robe|scarf|gloves|mittens|clothing|apparel)\b/i
  },

  // ── 7. SPORTS ────────────────────────────────────────────────────────────────
  {
    category: 'Sports',
    re: /\b(?:dumbbells?|barbells?|kettlebells?|weight plates?|weight set|resistance bands?|pull.?up bar|squat rack|weight bench|treadmill|stationary bike|peloton|elliptical|rowing machine|yoga mat|foam roller|gym bag|protein powder|whey protein|pre.?workout|creatine|bcaa|basketball|football|soccer ball|baseball|tennis racket|golf clubs?|golf bag|hockey stick|boxing gloves|mma gloves|cycling shoes|road bike|mountain bike|gravel bike|bike helmet|skateboard|longboard|scooter|hiking boots|hiking pole|camping tent|sleeping bag|camping stove|fishing rod|fishing reel|kayak|paddleboard|surfboard|skis?\b|snowboard|climbing harness|jump rope|resistance tube|ab roller|compression sleeve|shin guard|batting glove|workout equipment|home gym|squat stand|running shoes|trail shoes|athletic shoes|sneakers|cleats|football cleats|soccer cleats|basketball shoes|tennis shoes|cross training shoes|workout shoes|gym shoes)\b/i
  },
]

export function categorize(title = '', description = '') {
  const text = (title + ' ' + description).trim()
  if (!text) return 'General'
  for (const { category, re } of RULES) {
    if (re.test(text)) return category
  }
  return 'General'
}

// Maps raw external feed category labels (Best Buy, Slickdeals, Walmart, etc.)
// → our 7 site categories. Falls back to title-based categorize() on miss.
const CATEGORY_MAP = {
  // Computers (includes tablets per product spec)
  'Computers':                       'Computers',
  'Laptops':                         'Computers',
  'Tablets':                         'Computers',
  // Phones
  'Cell Phones':                     'Phones',
  'Smartphones':                     'Phones',
  // Accessories (includes headphones/earbuds per product spec)
  'Computer Accessories':            'Accessories',
  'Cell Phone & Tablet Accessories': 'Accessories',
  'Phone Accessories':               'Accessories',
  'Cables & Adapters':               'Accessories',
  'Headphones':                      'Accessories',
  'Earbuds':                         'Accessories',
  'Power Protection':                'Accessories',
  // Electronics (speakers/AV stay here; "Audio" is ambiguous, leave Electronics)
  'Speakers':                        'Electronics',
  'Audio':                           'Electronics',
  'Speakers & Accessories':          'Electronics',
  'TVs':                             'Electronics',
  'Monitors':                        'Electronics',
  'Dash Camera':                     'Electronics',
  'Gaming':                          'Electronics',
  'Wearables':                       'Electronics',
  'Smart Home':                      'Electronics',
  'Electronics':                     'Electronics',
  // Home
  'Home':                            'Home',
  'Kitchen & Houseware':             'Home',
  'Home Improvement':                'Home',
  'Furniture':                       'Home',
  'Lights':                          'Home',
  'Household Supplies':              'Home',
  'Tools & Hardware':                'Home',
  // Fashion
  'Apparels & Accessories':          'Fashion',
  'Footwear':                        'Fashion',
  'Eyewear & Eye Care':              'Fashion',
  // Sports
  'Sports & Outdoors':               'Sports',
}

export function mapExternalCategory(raw = '', title = '') {
  if (CATEGORY_MAP[raw]) return CATEGORY_MAP[raw]
  return categorize(title)
}
