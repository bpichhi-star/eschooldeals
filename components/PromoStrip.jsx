export default function PromoStrip({ deals = [] }) {
  if (!deals.length) return null

  const featured = deals.slice(0, 4)

  return (
    <div className="promo-strip">
      <span className="promo-label">FEATURED</span>

      <div className="promo-cards">
        {featured.map((deal) => {
          const salePrice   = deal.salePrice   ?? deal.sale_price   ?? 0
          const origPrice   = deal.originalPrice ?? deal.original_price ?? 0
          const imageUrl    = deal.image ?? deal.imageUrl ?? deal.image_url ?? ''
          const proxySrc    = imageUrl ? `/api/img?url=${encodeURIComponent(imageUrl)}` : ''
          const discountPct = origPrice > 0 ? Math.round((1 - salePrice / origPrice) * 100) : 0

          return (
            <a
              key={deal.id}
              href={deal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="promo-card"
            >
              <div className="promo-thumb">
                {proxySrc && (
                  <img
                    src={proxySrc}
                    alt={deal.title}
                    className="promo-thumb-img"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
                {discountPct > 0 && (
                  <span className="promo-pct">-{discountPct}%</span>
                )}
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
  )
}
