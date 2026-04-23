const AMZN_TAG = 'eschooldeals-20'

function affiliateUrl(merchant, productUrl) {
  if (!productUrl) return '#'
  switch (merchant) {
    case 'AMAZON':
      if (productUrl.includes('tag=')) return productUrl
      return `${productUrl}${productUrl.includes('?') ? '&' : '?'}tag=${AMZN_TAG}`
    default:
      return productUrl
  }
}

export default function PromoStrip({ deals = [] }) {
  if (!Array.isArray(deals) || deals.length === 0) {
    return null
  }

  return (
    <div className="promo-strip">
      <span className="promo-label">PROMOTED</span>
      <div className="promo-cards">
        {deals.map((deal) => {
          const salePrice = Number(deal.salePrice || 0)
          const href = affiliateUrl(deal.merchant, deal.productUrl || deal.url)

          return (
            <a
              key={deal.id}
              href={href}
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
              <div className="promo-price">
                {salePrice > 0 ? `$${salePrice.toFixed(2)}` : 'Check price'}
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
