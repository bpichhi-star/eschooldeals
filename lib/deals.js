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

// ─── IMAGE HELPERS ────────────────────────────────────────────────────────────
// Only image construction lives here. Affiliate wrapping lives in DealCard.jsx.

// Amazon: ASIN-based image URL
const amznImg = (asin) =>
  `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SL300_.jpg`

// ─── SCHEMA CONTRACT ──────────────────────────────────────────────────────────
// Every deal and promo object must follow this shape.
// When feeds / scrapers are wired up, they must output this exact shape.
//
// Required fields:
//   id            {string|number}  unique identifier
//   title         {string}         full product name as listed by merchant
//   merchant      {string}         uppercase: 'AMAZON' | 'BEST BUY' | 'WOOT' | etc.
//   category      {string}         must match a value in the categories array above
//   originalPrice {number}         pre-sale price in USD (number, no $ sign)
//   salePrice     {number}         current sale price in USD (number, no $ sign)
//   discountPct   {number}         integer percent off (e.g. 47 for 47%)
//   productUrl    {string}         DIRECT product page URL — no search pages, no
//                                  homepages, no category pages. Must land on the
//                                  exact product being sold. Affiliate tags are
//                                  added automatically by DealCard.jsx at render.
//   image         {string}         image URL (will be proxied through /api/img)
//   thumbBg       {string}         pastel hex color for card background (#rrggbb)
//   isStudentPick {boolean}        true to show the STUDENT PICK badge

// ─── PROMO STRIP ─────────────────────────────────────────────────────────────

export const promoDeals = [
  {
    id: 'p1',
    title: 'Sony WH-1000XM5 Headphones',
    price: 148,
    image: amznImg('B09XS7JWHH'),
    thumbBg: '#e8eef5',
    merchant: 'AMAZON',
    productUrl: 'https://www.amazon.com/dp/B09XS7JWHH',
  },
  {
    id: 'p2',
    title: 'LG 55" OLED 4K TV',
    price: 799,
    image: amznImg('B0BVX9MFR8'),
    thumbBg: '#f5ede8',
    merchant: 'BEST BUY',
    productUrl: 'https://www.bestbuy.com/site/lg-55-class-c3-series-oled-4k-uhd-smart-webos-tv/6535928.p',
  },
  {
    id: 'p3',
    title: 'Samsung Galaxy Watch 8',
    price: 165,
    image: amznImg('B0C6BGWB3M'),
    thumbBg: '#edf5ed',
    merchant: 'WOOT',
    productUrl: 'https://www.woot.com/offers/samsung-galaxy-watch6-44mm',
  },
  {
    id: 'p4',
    title: 'Acer Aspire 5 Laptop',
    price: 449,
    image: amznImg('B09NQXS8XJ'),
    thumbBg: '#f0eef8',
    merchant: 'AMAZON',
    productUrl: 'https://www.amazon.com/dp/B09NQXS8XJ',
  },
]

// ─
