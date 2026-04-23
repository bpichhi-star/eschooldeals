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
          const imageUrl    = deal.imageUrl ?? deal.image_url ?? ''
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
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={deal.title}
                    className="promo-thumb-img"
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
