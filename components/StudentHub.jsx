import { studentDeals } from '@/lib/deals'

export default function StudentHub() {
  return (
    <section className="student-hub">
      <div className="student-hub-header">
        <h2 className="student-hub-title">Student Perks</h2>
        <span className="student-hub-sub">Free & discounted software, subscriptions & more</span>
      </div>

      <div className="student-grid">
        {studentDeals.map((item) => (
          <a key={item.id} href={item.url} className="student-card">
            <div className="student-brand-dot" style={{ background: item.color }}>
              {item.logo}
            </div>
            <div className="student-brand-name">{item.brand}</div>
            <div className="student-offer">{item.offer}</div>
            <div>
              <span className="student-price">{item.price}</span>{' '}
              {item.original && (
                <span className="student-price-orig">{item.original}</span>
              )}
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
