export default function DealCard({ deal }) {
  const salePrice   = deal.salePrice   ?? deal.sale_price    ?? 0
  const origPrice   = deal.originalPrice ?? deal.original_price ?? 0
  const savings     = (origPrice - salePrice).toFixed(2)
  const discountPct = origPrice > 0 ? Math.round((1 - salePrice / origPrice) * 100) : 0
  const imageUrl    = deal.image ?? deal.imageUrl ?? deal.image_url ?? ''
  const merchant    = deal.merchant ?? deal.store ?? 'Amazon'

  return (
    <a href={deal.url} target="_blank" rel="noopener noreferrer" className="deal-card">
      <div className="deal-thumb">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={deal.title}
            className="deal-thumb-img"
            onError={(e) => {
              const proxy = `/api/img?url=${encodeURIComponent(imageUrl)}`
              if (e.currentTarget.src !== proxy) {
                e.currentTarget.src = proxy
              } else {
                e.currentTarget.style.display = 'none'
              }
            }}
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
            <span className="deal-sale">${salePrice.toFixed(0)}</span>
            {origPrice > salePrice && (
              <span className="deal-original">${origPrice.toFixed(0)}</span>
            )}
          </div>
          {savings > 0 && <div className="deal-save">You save ${savings}</div>}
          <div className="deal-cta">See Deal →</div>
        </div>
      </div>
    </a>
  )
}
