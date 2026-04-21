export default function DealCard({ deal }) {
  const savings = (deal.originalPrice - deal.salePrice).toFixed(2)

  return (
    <a
      href={deal.url}
      className="deal-card"
      aria-label={deal.title}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="deal-thumb" style={{ background: deal.thumbBg }}>
        <div className="deal-pct">-{deal.discountPct}%</div>
        {deal.isStudentPick && (
          <div className="student-badge">STUDENT PICK</div>
        )}
      </div>

      <div className="deal-body">
        <div className="deal-merchant">{deal.merchant}</div>
        <div className="deal-title">{deal.title}</div>

        <div className="deal-pricing">
          <div className="deal-price-row">
            <span className="deal-sale">${deal.salePrice.toFixed(0)}</span>
            <span className="deal-original">${deal.originalPrice.toFixed(0)}</span>
          </div>
          <div className="deal-save">Save ${savings}</div>
        </div>
      </div>
    </a>
  )
}
