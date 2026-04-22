const AMZN_TAG = 'eschooldeals-20'
const WOOT_CID = '7936037'
const WOOT_AID = '4909784'

function affiliateUrl(merchant, productUrl) {
  if (!productUrl) return '#'

  switch (merchant) {
    case 'AMAZON':
      if (productUrl.includes('tag=')) return productUrl
      return `${productUrl}${productUrl.includes('?') ? '&' : '?'}tag=${AMZN_TAG}`

    case 'WOOT':
      return `https://www.anrdoezrs.net/click-${WOOT_CID}-${WOOT_AID}?url=${encodeURIComponent(productUrl)}`

    default:
      return productUrl
  }
}

export default function DealCard({ deal }) {
  const original = Number(deal.originalPrice || 0)
  const sale = Number(deal.salePrice || 0)
  const savings = Math.max(original - sale, 0).toFixed(2)
  const imageSrc = deal.image || null
  const href = affiliateUrl(deal.merchant, deal.productUrl || deal.url)
  const isAmazon = deal.merchant === 'AMAZON'

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
        style={{ background: deal.thumbBg || '#f5f5f7', padding: '10px' }}
      >
        {!isAmazon && <div className="deal-pct">-{deal.discountPct}%</div>}

        {deal.isStudentPick && (
          <div className="student-badge">STUDENT PICK</div>
        )}

        {imageSrc && (
          <img
            src={imageSrc}
            alt={deal.title}
            className="deal-img"
            loading="lazy"
            referrerPolicy="no-referrer"
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
          {isAmazon ? (
            <div className="deal-save">View current price on Amazon</div>
          ) : (
            <>
              <div className="deal-price-row">
                <span className="deal-sale">${sale.toFixed(2)}</span>
                <span className="deal-original">${original.toFixed(2)}</span>
              </div>

              <div className="deal-save">Save ${savings}</div>
            </>
          )}
        </div>
      </div>
    </a>
  )
}
