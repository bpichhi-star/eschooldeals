import Link from 'next/link'

// Top-tier student perks shown on the homepage. The existing CSS grid
// (.student-grid in app/globals.css) is `repeat(6, 1fr)`, so 12 entries
// naturally form two rows of six on desktop. Mobile collapses to three
// columns so 12 entries become four rows of three.
//
// The final tile is a CTA to /perks where a fuller catalog of perks lives.
// It uses isMore=true to switch from <a target="_blank"> to a Next.js
// <Link> for client-side navigation, and gets a distinct visual treatment
// (dashed border + indigo accent) so it doesn't compete visually with the
// other 11 brand cards.
const STUDENT_DEALS = [
  // ── Row 1: original six ────────────────────────────────────────────────
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
    brand: 'Notion',
    color: '#000000',
    offer: 'Notion Plus for Free',
    price: 'Free',
    originalPrice: '$16/mo',
    url: 'https://www.notion.so/students',
  },
  {
    id: 6,
    brand: 'Adobe',
    color: '#FF0000',
    offer: 'Creative Cloud 60%+ off',
    price: '$19.99/mo',
    originalPrice: '$59.99/mo',
    url: 'https://www.adobe.com/creativecloud/buy/students.html',
  },

  // ── Row 2: five more perks + More CTA ─────────────────────────────────
  {
    id: 7,
    brand: 'Microsoft',
    color: '#00A4EF',
    offer: 'Office 365 Education',
    price: 'Free',
    originalPrice: '$9.99/mo',
    url: 'https://www.microsoft.com/en-us/education/products/office',
  },
  {
    id: 8,
    brand: 'GitHub',
    color: '#181717',
    offer: 'Student Developer Pack',
    price: 'Free',
    originalPrice: '$200K+ value',
    url: 'https://education.github.com/pack',
  },
  {
    id: 9,
    brand: 'LinkedIn',
    color: '#0A66C2',
    offer: 'Premium 1-Month Free',
    price: 'Free trial',
    originalPrice: '$39.99/mo',
    url: 'https://www.linkedin.com/premium/products/',
  },
  {
    id: 10,
    brand: 'Canva',
    color: '#00C4CC',
    offer: 'Pro for Education',
    price: 'Free',
    originalPrice: '$14.99/mo',
    url: 'https://www.canva.com/education/',
  },
  {
    id: 11,
    brand: 'Headspace',
    color: '#F47D31',
    offer: 'Student Plan',
    price: '$9.99/yr',
    originalPrice: '$69.99/yr',
    url: 'https://www.headspace.com/studentplan',
  },
  {
    id: 12,
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
          // doesn't visually compete with the eleven brand tiles.
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
