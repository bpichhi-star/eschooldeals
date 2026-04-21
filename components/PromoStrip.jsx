import { promoDeals } from '@/lib/deals'

export default function PromoStrip() {
  return (
    <div className="promo-strip">
      <span className="promo-label">PROMOTED</span>

      <div className="promo-cards">
        {promoDeals.map((deal) => (
          <a
            key={deal.id}
            href={deal.url}
            className="promo-card"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div
              className="promo-thumb"
              style={{
                background: deal.thumbBg,
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
            <div className="promo-price">${deal.price}</div>
          </a>
        ))}
      </div>
    </div>
  )
}
