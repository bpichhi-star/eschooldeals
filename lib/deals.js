export const categories = [
  'Today',
  'Electronics',
  'Computers',
  'Phones',
  'Home',
  'Kitchen',
  'Fashion',
  'Sports',
  'Travel',
  'Toys',
  'Textbooks',
  'Software',
  'Dorm',
  'Office',
  'Beauty',
  'Automotive',
  'Tools',
  'Pets',
  'Food',
]

// ── AFFILIATE HELPERS ─────────────────────────────────────────────────────────

const AMZN_TAG = 'eschooldeals-20'

// Amazon: search URL — guaranteed to work for any product term
const amzn = (searchTerm) =>
  `https://www.amazon.com/s?k=${encodeURIComponent(searchTerm)}&tag=${AMZN_TAG}`

// Amazon: ASIN-based image URL — constructs reliably from product ID
const amznImg = (asin) =>
  `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SL300_.jpg`

// Woot via Commission Junction
// CID: 7936037 | Woot Advertiser ID: 4909784
const woot = (path = '') =>
  `https://www.anrdoezrs.net/click-7936037-4909784?url=${encodeURIComponent('https://www.woot.com' + path)}`

// ── PROMO STRIP ───────────────────────────────────────────────────────────────

export const promoDeals = [
  {
    id: 'p1',
    title: 'Sony WH-1000XM5 Headphones',
    price: 148,
    image: amznImg('B09XS7JWHH'),
    thumbBg: '#e8eef5',
    url: amzn('Sony WH-1000XM5'),
  },
  {
    id: 'p2',
    title: 'LG 55" OLED 4K TV',
    price: 799,
    image: amznImg('B0BVX9MFR8'),
    thumbBg: '#f5ede8',
    url: amzn('LG 55 inch OLED C3 4K TV'),
  },
  {
    id: 'p3',
    title: 'Samsung Galaxy Watch 8',
    price: 165,
    image: amznImg('B0C6BGWB3M'),
    thumbBg: '#edf5ed',
    url: woot(),
  },
  {
    id: 'p4',
    title: 'Acer Aspire 5 Laptop',
    price: 449,
    image: amznImg('B09NQXS8XJ'),
    thumbBg: '#f0eef8',
    url: amzn('Acer Aspire 5 laptop 16GB'),
  },
]

// ── MAIN DEALS ────────────────────────────────────────────────────────────────

export const deals = [
  {
    id: 1,
    title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
    merchant: 'AMAZON',
    category: 'Electronics',
    originalPrice: 349.99,
    salePrice: 148.00,
    discountPct: 58,
    thumbBg: '#eef3f8',
    image: amznImg('B09XS7JWHH'),
    url: amzn('Sony WH-1000XM5'),
    isStudentPick: true,
  },
  {
    id: 2,
    title: 'LG 55" OLED evo C3 Series 4K UHD Smart TV',
    merchant: 'BEST BUY',
    category: 'Electronics',
    originalPrice: 1499.99,
    salePrice: 799.00,
    discountPct: 47,
    thumbBg: '#faf4ee',
    image: amznImg('B0BVX9MFR8'),
    url: 'https://www.bestbuy.com/site/searchpage.jsp?st=LG+55+OLED+C3',
    isStudentPick: false,
  },
  {
    id: 3,
    title: 'Samsung Galaxy Watch 8 44mm Smartwatch',
    merchant: 'WOOT',
    category: 'Electronics',
    originalPrice: 289.99,
    salePrice: 165.00,
    discountPct: 43,
    thumbBg: '#eef6ee',
    image: amznImg('B0C6BGWB3M'),
    url: woot(),
    isStudentPick: false,
  },
  {
    id: 4,
    title: 'DeWalt 20V Max Cordless Drill Driver Set w/ Battery & Charger',
    merchant: 'HOME DEPOT',
    category: 'Tools',
    originalPrice: 199.99,
    salePrice: 78.00,
    discountPct: 61,
    thumbBg: '#f8eeee',
    image: amznImg('B00ET5VMTU'),
    url: 'https://www.homedepot.com/s/dewalt%2020v%20drill',
    isStudentPick: false,
  },
  {
    id: 5,
    title: 'Acer Aspire 5 15.6" FHD Laptop 16GB RAM 512GB SSD',
    merchant: 'AMAZON',
    category: 'Computers',
    originalPrice: 699.99,
    salePrice: 449.00,
    discountPct: 35,
    thumbBg: '#f0eef8',
    image: amznImg('B09NQXS8XJ'),
    url: amzn('Acer Aspire 5 laptop 16GB 512GB'),
    isStudentPick: true,
  },
  {
    id: 6,
    title: 'Dyson V8 Cordless Vacuum Cleaner Certified Refurbished',
    merchant: 'WALMART',
    category: 'Home',
    originalPrice: 399.99,
    salePrice: 189.00,
    discountPct: 52,
    thumbBg: '#eef5f5',
    image: amznImg('B01HZXUT2S'),
    url: 'https://www.walmart.com/search?q=dyson+v8+cordless+vacuum',
    isStudentPick: false,
  },
  {
    id: 7,
    title: 'Ninja Creami 7-in-1 Ice Cream & Frozen Treat Maker',
    merchant: 'WOOT',
    category: 'Kitchen',
    originalPrice: 299.99,
    salePrice: 99.00,
    discountPct: 68,
    thumbBg: '#faf5ee',
    image: amznImg('B092DWFJWQ'),
    url: woot(),
    isStudentPick: true,
  },
  {
    id: 8,
    title: 'Reolink 4K Outdoor Security Camera System w/ Night Vision',
    merchant: 'EBAY',
    category: 'Home',
    originalPrice: 219.99,
    salePrice: 129.00,
    discountPct: 41,
    thumbBg: '#f0eef8',
    image: amznImg('B08BKVY4ZC'),
    url: 'https://www.ebay.com/sch/i.html?_nkw=reolink+4k+security+camera',
    isStudentPick: false,
  },
  {
    id: 9,
    title: 'Instant Pot Duo 7-in-1 Electric Pressure Cooker 6Qt',
    merchant: 'TARGET',
    category: 'Kitchen',
    originalPrice: 99.99,
    salePrice: 59.00,
    discountPct: 39,
    thumbBg: '#f5f5ee',
    image: amznImg('B00FLYWNYQ'),
    url: 'https://www.target.com/s?searchTerm=instant+pot+duo+6qt',
    isStudentPick: true,
  },
  {
    id: 10,
    title: 'Bose QuietComfort 45 Bluetooth Wireless Headphones',
    merchant: 'AMAZON',
    category: 'Electronics',
    originalPrice: 299.99,
    salePrice: 134.00,
    discountPct: 55,
    thumbBg: '#eef3ee',
    image: amznImg('B098FKXT8L'),
    url: amzn('Bose QuietComfort 45'),
    isStudentPick: false,
  },
]

// ── STUDENT PERKS ─────────────────────────────────────────────────────────────

export const studentDeals = [
  {
    id: 's1',
    brand: 'Spotify',
    offer: 'Premium for Students',
    price: '$5.99/mo',
    originalPrice: '$11.99/mo',
    color: '#1DB954',
    url: 'https://www.spotify.com/us/student/',
  },
  {
    id: 's2',
    brand: 'Amazon Prime',
    offer: 'Student — 6 months free',
    price: '$0',
    originalPrice: '$139/yr',
    color: '#FF9900',
    url: 'https://www.amazon.com/joinstudent',
  },
  {
    id: 's3',
    brand: 'Apple Music',
    offer: 'Student Discount',
    price: '$5.99/mo',
    originalPrice: '$10.99/mo',
    color: '#FC3C44',
    url: 'https://www.apple.com/shop/buy-music/membership/student',
  },
  {
    id: 's4',
    brand: 'Adobe CC',
    offer: 'Creative Cloud Student',
    price: '$19.99/mo',
    originalPrice: '$59.99/mo',
    color: '#FF0000',
    url: 'https://www.adobe.com/creativecloud/buy/students.html',
  },
  {
    id: 's5',
    brand: 'Microsoft 365',
    offer: 'Education — Free',
    price: '$0',
    originalPrice: '$99.99/yr',
    color: '#0078D4',
    url: 'https://www.microsoft.com/en-us/education/products/office',
  },
  {
    id: 's6',
    brand: 'Notion',
    offer: 'Plus Plan for Students',
    price: '$0',
    originalPrice: '$16/mo',
    color: '#000000',
    url: 'https://www.notion.so/product/notion-for-education',
  },
]
