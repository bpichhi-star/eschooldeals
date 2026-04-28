const STUDENT_DEALS = [
  { id: 1, brand: 'Spotify',    color: '#1DB954', offer: 'Premium for Students',       price: '$5.99/mo',  originalPrice: '$11.99/mo', url: 'https://www.spotify.com/us/student/' },
  { id: 2, brand: 'Apple',      color: '#1d1d1f', offer: 'Apple Music Student Plan',   price: '$5.99/mo',  originalPrice: '$10.99/mo', url: 'https://music.apple.com/us/student' },
  { id: 3, brand: 'Amazon',     color: '#FF9900', offer: 'Prime Student 6-mo Trial',   price: 'Free',      originalPrice: '$14.99/mo', url: 'https://www.amazon.com/joinstudent' },
  { id: 4, brand: 'YouTube',    color: '#FF0000', offer: 'YouTube Premium Student',    price: '$7.99/mo',  originalPrice: '$13.99/mo', url: 'https://www.youtube.com/premium/student' },
  { id: 5, brand: 'Notion',     color: '#000000', offer: 'Notion Plus for Free',       price: 'Free',      originalPrice: '$16/mo',    url: 'https://www.notion.so/students' },
  { id: 6, brand: 'Adobe',      color: '#FF0000', offer: 'Creative Cloud 65% off',     price: '$19.99/mo', originalPrice: '$54.99/mo', url: 'https://www.adobe.com/creativecloud/plans/student.html' },
]

export default function StudentHub() {
  return (
    <section className="student-hub">
      <div className="student-hub-header">
        <h2 className="student-hub-title">Student Perks</h2>
        <span className="student-hub-sub">Free & discounted software, subscriptions & more</span>
      </div>

      <div className="student-grid">
        {STUDENT_DEALS.map((item) => (
          <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="student-card">
            <div className="student-brand-dot" style={{ background: item.color }}>
              {item.brand.charAt(0)}
            </div>
            <div className="student-brand-name">{item.brand}</div>
            <div className="student-offer">{item.offer}</div>
            <div className="student-price">{item.price}</div>
            <div className="student-price-orig">{item.originalPrice}</div>
          </a>
        ))}
      </div>
    </section>
  )
}
