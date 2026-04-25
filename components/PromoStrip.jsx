export default function PromoStrip({ deals = [] }) {
  if (!deals.length) return null
  const featured = deals.slice(0, 6)
  return (
    <div className="promo-strip-wrap">
      <div className="section-header">
        <h2 className="section-title">⭐ ESD Student Recommended</h2>
      </div>
      <div className="promo-strip">
        <div className="promo-cards">
          {featured.map((deal) => {
            const salePrice   = deal.sale_price  ?? deal.salePrice  ?? 0
            const origPrice   = deal.original_price ?? deal.originalPrice ?? 0
            const imageUrl    = deal.image_url   ?? deal.imageUrl   ?? deal.image ?? ''
            const dealUrl     = deal.product_url ?? deal.url        ?? '#'
            const proxySrc    = imageUrl ? `/api/img?url=${encodeURIComponent(imageUrl)}` : ''
            const discountPct = origPrice > 0 ? Math.round((1 - salePrice / origPrice) * 100) : 0
            return (
              <a key={deal.id} href={dealUrl} target="_blank" rel="noopener noreferrer" className="promo-card">
                <div className="promo-thumb">
                  {proxySrc && (
                    <img src={proxySrc} alt={deal.title} className="promo-thumb-img"
                      onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  )}
                  {discountPct > 0 && <span className="promo-pct">-{discountPct}%</span>}
                </div>
                <div className="promo-name">{deal.title}</div>
                <div className="promo-price">
                  ${typeof salePrice === 'number' ? salePrice.toFixed(2) : salePrice}
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
