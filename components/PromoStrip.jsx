export default function PromoStrip({ deals = [] }) {
  if (!deals.length) return null

  // Show 4 or 5 cards — 5 if enough deals, otherwise 4
  const featured = deals.slice(0, Math.min(deals.length, 5))

  return (
    <div className="promo-strip">
      <div className="promo-strip-inner">
        <div className="promo-label-row">
          <span className="promo-label">FEATURED</span>
        </div>

        <div
          className="promo-cards"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${featured.length}, 1fr)`,
            gap: '12px',
          }}
        >
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
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                      onError={(e) => {
                        // Fallback: try the proxy route
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

                <div
                  className="promo-name"
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#1a1a1a',
                    lineHeight: 1.35,
                    marginTop: '8px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {deal.title}
                </div>

                <div
                  className="promo-price"
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: '#cc0000',
                    marginTop: '6px',
                  }}
                >
                  ${typeof salePrice === 'number' ? salePrice.toFixed(2) : salePrice}
                </div>

                {origPrice > 0 && (
                  <div
                    className="promo-orig"
                    style={{
                      fontSize: '0.78rem',
                      color: '#888',
                      textDecoration: 'line-through',
                      marginTop: '2px',
                    }}
                  >
                    ${typeof origPrice === 'number' ? origPrice.toFixed(2) : origPrice}
                  </div>
                )}
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
