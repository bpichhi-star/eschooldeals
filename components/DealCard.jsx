// ─── AFFILIATE TAG MAP ────────────────────────────────────────────────────────
// All affiliate logic lives here. deals.js only stores raw productUrl.
// To add a new merchant program: add a case below and return the wrapped URL.

const AMZN_TAG = 'eschooldeals-20'
const WOOT_CID = '7936037'
const WOOT_AID = '4909784'

function affiliateUrl(merchant, productUrl) {
  switch (merchant) {
    case 'AMAZON':
      return `${productUrl}${productUrl.includes('?') ? '&' : '?'}tag=${AMZN_TAG}`
    case 'WOOT':
      return `https://www.anrdoezrs.net/click-${WOOT_CID}-${WOOT_AID}?url=${encodeURIComponent(productUrl)}`
    // Add future programs here:
    // case 'BEST BUY':  return CJ or Rakuten wrapper
    // case 'WALMART':   return Impact wrapper
    // case 'TARGET':    return Impact wrapper
    // case 'EBAY':      return EPN wrapper
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
          <img src={proxiedImage} alt={deal.title} className="deal-img" />
        )}
      </div>
      <div className="deal-info">
        <div className="deal-merchant">{deal.merchant}</div>
        <div className="deal-title">{deal.title}</div>
        <div className="deal-pricing">
          <span className="deal-sale">${deal.salePrice.toFixed(2)}</span>
          <span className="deal-orig">${deal.originalPrice.toFixed(2)}</span>
        </div>
        <div className="deal-save">Save ${savings}</div>
      </div>
    </a>
  )
}
