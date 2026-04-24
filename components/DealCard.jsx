export default function DealCard({ deal }) {
  const salePrice = deal.salePrice ?? deal.sale_price ?? 0
  const origPrice = deal.originalPrice ?? deal.original_price ?? 0
  const savings = origPrice > salePrice ? (origPrice - salePrice).toFixed(2) : null
  const discountPct = origPrice > 0 ? Math.round((1 - salePrice / origPrice) * 100) : 0
  const rawImage = deal.image ?? deal.imageUrl ?? deal.image_url ?? ''
  const imageUrl = rawImage ? `/api/img?url=${encodeURIComponent(rawImage)}` : ''
  const merchant = deal.merchant ?? deal.store ?? 'Amazon'

  return (
    <a href={deal.url} target="_blank" rel="noopener noreferrer" className="deal-card">
      <div className="deal-thumb">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={deal.title}
            className="deal-thumb-img"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        )}
        {discountPct > 0 && <div className="deal-pct">-{discountPct}%</div>}
        {deal.isStudentPick && <div className="student-badge">STUDENT PICK</div>}
      </div>
      <div className="deal-body">
        <div className="deal-merchant">{merchant}</div>
        <div className="deal-title">{deal.title}</div>
        <div className="deal-pricing">
          <div className="deal-price-row">
            <span className="deal-sale">${typeof salePrice === 'number' ? salePrice.toFixed(0) : salePrice}</span>
            {origPrice > salePrice && (
              <span className="deal-original">${typeof origPrice === 'number' ? origPrice.toFixed(0) : origPrice}</span>
            )}
          </div>
          {savings && <div className="deal-save">You save ${savings}</div>}
          <div className="deal-cta">See Deal →</div>
        </div>
      </div>
    </a>
  )
}
