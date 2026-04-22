const AMZN_TAG = 'eschooldeals-20'
const WOOT_CID = '7936037'
const WOOT_AID = '4909784'

function affiliateUrl(merchant, productUrl) {
  switch (merchant) {
    case 'AMAZON':
      return `${productUrl}${productUrl.includes('?') ? '&' : '?'}tag=${AMZN_TAG}`
    case 'WOOT':
      return `https://www.anrdoezrs.net/click-${WOOT_CID}-${WOOT_AID}?url=${encodeURIComponent(productUrl)}`
    default:
      return productUrl
  }
}

export default function DealCard({ deal }) {
  const savings = (deal.originalPrice - deal.salePrice).toFixed(2)
  const proxiedImage = deal.image
    ? `/api/img?url=${encodeURIComponent(deal.image)}`
    : null

  const href = affiliateUrl(deal.merchant, deal.productUrl)

  return (
    <a
      href={href}
      className="deal-card"
      aria-label={deal.title}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div
        className="deal-thumb"
        style={{ background: deal.thumbBg, padding: '10px' }}
      >
        <div className="deal-pct">-{deal.discountPct}%</div>

        {deal.isStudentPick && (
          <div className="student-badge">STUDENT PICK</div>
        )}

        {proxiedImage && (
          <img
            src={proxiedImage}
            alt={deal.title}
            className="deal-img"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        )}
      </div>

      <div className="deal-body">
        <div className="deal-merchant">{deal.merchant}</div>

        <div className="deal-title">{deal.title}</div>

        <div className="deal-pricing">
          <div className="deal-price-row">
            <span className="deal-sale">${deal.salePrice.toFixed(2)}</span>
            <span className="deal-original">
              ${deal.originalPrice.toFixed(2)}
            </span>
          </div>

          <div className="deal-save">Save ${savings}</div>
        </div>
      </div>
    </a>
  )
}
