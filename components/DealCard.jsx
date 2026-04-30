export default function DealCard({ deal }) {
  const salePrice  = deal.salePrice  ?? deal.sale_price  ?? 0
  const origPrice  = deal.originalPrice ?? deal.original_price ?? 0
  const savings    = origPrice > salePrice ? (origPrice - salePrice).toFixed(2) : null
  const discountPct = origPrice > 0 ? Math.round((1 - salePrice / origPrice) * 100) : 0
  const rawImage   = deal.image ?? deal.imageUrl ?? deal.image_url ?? ''
  const imageUrl   = rawImage ? '/api/img?url=' + encodeURIComponent(rawImage) : ''
  const merchant   = deal.merchant ?? deal.store ?? 'Amazon'
  const placeholderLetter = merchant.replace(/[^a-zA-Z]/g, '')[0]?.toUpperCase() ?? '?'

  // Fire-and-forget click counter. Uses sendBeacon when available (most
  // reliable when the user is navigating away) and falls back to fetch
  // with keepalive. Either path is non-blocking so the outbound click
  // never waits on us. Failures are swallowed silently in the API — a
  // missed count is far better than disrupting the user's click.
  function trackClick() {
    if (deal.id == null) return
    const url  = '/api/track-click'
    const body = JSON.stringify({ id: deal.id })
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' })
        navigator.sendBeacon(url, blob)
        return
      }
      fetch(url, {
        method:    'POST',
        headers:   { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    } catch { /* swallow */ }
  }

  return (
    <a href={deal.url} target="_blank" rel="noopener noreferrer" className="deal-card" onClick={trackClick}>
      <div className="deal-thumb">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={deal.title}
            className="deal-thumb-img"
            onError={(e) => {
              if (rawImage && e.currentTarget.src !== rawImage) {
                e.currentTarget.src = rawImage
              } else {
                e.currentTarget.style.display = 'none'
                if (e.currentTarget.nextSibling && e.currentTarget.nextSibling.style) {
                  e.currentTarget.nextSibling.style.display = 'flex'
                }
              }
            }}
          />
        ) : null}
        <div
          className="deal-thumb-placeholder"
          style={{
            display: imageUrl ? 'none' : 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            background: 'var(--bg-surface, #f5f5f7)',
            color: 'var(--text-tertiary, #aeaeb2)',
            fontSize: 28,
            fontWeight: 700,
            fontFamily: 'var(--font)',
            letterSpacing: '-0.5px',
            userSelect: 'none',
          }}
        >
          {placeholderLetter}
        </div>
        {discountPct > 0 && <div className="deal-pct">-{discountPct}%</div>}
        {deal.isStudentPick && <div className="student-badge">STUDENT PICK</div>}
      </div>
      <div className="deal-body">
        <div className="deal-merchant">{merchant}</div>
        <div className="deal-title">{deal.title}</div>
        <div className="deal-pricing">
          <div className="deal-price-row">
            <span className="deal-sale">${typeof salePrice === 'number' ? salePrice.toFixed(0) : salePrice}</span>
            {origPrice > salePrice && (
              <span className="deal-original">${typeof origPrice === 'number' ? origPrice.toFixed(0) : origPrice}</span>
            )}
          </div>
          {savings && <div className="deal-save">You save ${savings}</div>}
          <div className="deal-cta">See Deal →</div>
        </div>
      </div>
    </a>
  )
}
