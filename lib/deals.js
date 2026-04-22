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

const amznImg = (asin) =>
  `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SL300_.jpg`

export const promoDeals = [
  {
    id: 'p1',
    title: 'Sony WH-1000XM5 Headphones',
    price: 148,
    image: amznImg('B09XS7JWHH'),
    thumbBg: '#e8eef5',
    merchant: 'AMAZON',
    url: 'https://www.amazon.com/dp/B09XS7JWHH',
    productUrl: 'https://www.amazon.com/dp/B09XS7JWHH',
  },
  {
    id: 'p2',
    title: 'LG 55" OLED 4K TV',
    price: 799,
    image: amznImg('B0BVX9MFR8'),
    thumbBg: '#f5ede8',
    merchant: 'BEST
