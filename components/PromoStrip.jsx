export default function PromoStrip({ deals = [] }) {
  if (!Array.isArray(deals) || deals.length === 0) {
    return null
  }

  return (
    <div className="promo-strip">
      <span className="promo-label">PROMOTED</span>

      <div className="promo-cards">
        {deals.map((deal) => (
          <a
            key={deal.id}
            href={deal.url || deal.productUrl}
            className="promo-card"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div
              className="promo-thumb"
              style={{
                background: deal.thumbBg || '#f5f5f7',
                padding: '6px',
              }}
            >
              {deal.image ? (
                <img
                  src={deal.image}
                  alt={deal.title}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              ) : null}
            </div>

            <div className="promo-name">{deal.title}</div>
            <div className="promo-price">${Number(deal.salePrice || 0).toFixed(2)}</div>
          </a>
        ))}
      </div>
    </div>
  )
}
