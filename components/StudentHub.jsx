import Link from 'next/link'

// Six top-tier student perks shown on the homepage in a single row. The
// existing CSS grid (.student-grid in app/globals.css) is `repeat(6, 1fr)`,
// so 6 entries form one row on desktop and two rows of three on mobile.
//
// The final tile is a CTA to /perks where the fuller catalog of perks
// lives (38+ deals across 8 categories). It uses isMore=true to switch
// from <a target="_blank"> to a Next.js <Link> for client-side navigation,
// and gets a distinct visual treatment (dashed border + indigo accent)
// so it doesn't compete visually with the five brand cards.
const STUDENT_DEALS = [
  {
    id: 1,
    brand: 'Spotify',
    color: '#1DB954',
    offer: 'Premium Student + Hulu',
    price: '$6.99/mo',
    originalPrice: '$11.99/mo',
    url: 'https://www.spotify.com/us/student/',
  },
  {
    id: 2,
    brand: 'Apple',
    color: '#1d1d1f',
    offer: 'Mac & iPad Education Pricing',
    price: 'Up to $200 off',
    originalPrice: '',
    url: 'https://www.apple.com/us-edu/store',
  },
  {
    id: 3,
    brand: 'Amazon',
    color: '#FF9900',
    offer: 'Prime for Young Adults — 6-mo Free',
    price: '$7.49/mo after',
    originalPrice: '$14.99/mo',
    url: 'https://www.amazon.com/youngadult',
  },
  {
    id: 4,
    brand: 'YouTube',
    color: '#FF0000',
    offer: 'YouTube Premium Student',
    price: '$7.99/mo',
    originalPrice: '$13.99/mo',
    url: 'https://www.youtube.com/premium/student',
  },
  {
    id: 5,
    brand: 'United',
    color: '#0033A0',
    offer: 'Young Adult Discount (ages 18–23)',
    price: '5% off',
    originalPrice: '',
    url: 'https://www.united.com/en/us/fly/mileageplus/young-adult-discount.html',
  },
  {
    id: 6,
    brand: 'More',
    color: '#6366f1',
    offer: 'More Student Deals',
    price: 'Browse all',
    originalPrice: '',
    url: '/perks',
    isMore: true,
  },
]

export default function StudentHub() {
  return (
    <section className="student-hub">
      <div className="student-hub-header">
        <h2 className="student-hub-title">Student Perks</h2>
        <span className="student-hub-sub">Free &amp; discounted software, subscriptions &amp; more</span>
      </div>
      <div className="student-grid">
        {STUDENT_DEALS.map((item) => {
          // The "More Student Deals" tile uses Next.js <Link> for internal
          // navigation and gets a distinct dashed-border treatment so it
          // doesn't visually compete with the brand tiles.
          if (item.isMore) {
            return (
              <Link
                key={item.id}
                href={item.url}
                className="student-card student-card-more"
                aria-label="Browse all student deals"
              >
                <div
                  className="student-brand-dot"
                  style={{ background: item.color }}
                  aria-hidden="true"
                >
                  →
                </div>
                <div className="student-brand-name">More</div>
                <div className="student-offer">{item.offer}</div>
                <div className="student-price" style={{ color: item.color }}>{item.price}</div>
              </Link>
            )
          }
          return (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="student-card"
            >
              <div className="student-brand-dot" style={{ background: item.color }}>
                {item.brand.charAt(0)}
              </div>
              <div className="student-brand-name">{item.brand}</div>
              <div className="student-offer">{item.offer}</div>
              <div className="student-price">{item.price}</div>
              {item.originalPrice && <div className="student-price-orig">{item.originalPrice}</div>}
            </a>
          )
        })}
      </div>
    </section>
  )
}
