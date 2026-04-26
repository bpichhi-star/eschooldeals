'use client'
import { useState, useEffect, useMemo } from 'react'
import NavBar from '@/components/NavBar'
import CategoryNav from '@/components/CategoryNav'
import PromoStrip from '@/components/PromoStrip'
import DealCard from '@/components/DealCard'
import AdSidebar from '@/components/AdSidebar'
import StudentHub from '@/components/StudentHub'

function getToday() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).toUpperCase()
}

const DEALS_PER_PAGE = 50

const CATEGORY_FILTERS = {
  Today:       () => true,
  Electronics: d => d.category === 'Electronics' ||
                    /\b(headphone|earbud|airpod|monitor|speaker|charger|cable|usb|hub|webcam|router|tv|television|camera|drone|smartwatch|tablet|kindle|ipad)\b/i.test(d.title),
  Computers:   d => d.category === 'Computers' ||
                    /\b(laptop|notebook|macbook|chromebook|desktop|pc tower|all.?in.?one|aio|mini pc|workstation|imac)\b/i.test(d.title),
  Phones:      d => d.category === 'Phones' ||
                    /\b(iphone|samsung galaxy|google pixel|smartphone|phone case|phone stand|phone holder|phone charger|cell phone)\b/i.test(d.title),
  Home:        d => d.category === 'Home' ||
                    /\b(vacuum|robot vacuum|lamp|furniture|sofa|couch|bed frame|mattress|pillow|blanket|chair|desk|shelf|storage|organizer|smart home|thermostat|doorbell)\b/i.test(d.title),
  Kitchen:     d => d.category === 'Kitchen' ||
                    /\b(blender|toaster|microwave|coffee maker|espresso|air fryer|instant pot|pressure cooker|cookware|pan set|knife set|food processor|kettle|mixer)\b/i.test(d.title),
  Fashion:     d => d.category === 'Fashion' ||
                    /\b(shoe|sneaker|boot|sandal|shirt|tee|jeans|jacket|coat|hoodie|sweater|dress|watch|sunglasses|wallet|handbag|purse)\b/i.test(d.title),
  Sports:      d => d.category === 'Sports' ||
                    /\b(yoga|fitness|dumbbell|barbell|kettlebell|treadmill|bike|cycling|tennis|basketball|football|soccer|golf|camping|hiking|outdoor)\b/i.test(d.title),
  Travel:      d => d.category === 'Travel' ||
                    /\b(luggage|suitcase|carry.?on|travel bag|duffel|backpack|passport|travel|garment bag)\b/i.test(d.title),
  Toys:        d => d.category === 'Toys' ||
                    /\b(lego|toy|puzzle|board game|action figure|doll|plush|stuffed animal|nerf|kids|playset)\b/i.test(d.title),
}

export default function HomePage() {
  const [deals,    setDeals]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [category, setCategory] = useState('Today')
  const [page,     setPage]     = useState(1)
  const today = getToday()

  useEffect(() => {
    fetch('/api/deals')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data))             setDeals(data)
        else if (Array.isArray(data?.deals)) setDeals(data.deals)
        else setDeals([])
      })
      .catch(() => setDeals([]))
      .finally(() => setLoading(false))
  }, [])

  const safeDeals = Array.isArray(deals) ? deals : []

  // ESD strip — ONLY manually curated is_featured deals, sorted by score, max 6
  const featuredDeals = safeDeals
    .filter(d => d.isFeatured)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 6)

  // Main grid — all active deals filtered by selected category
  const gridDeals = useMemo(() => {
    const filterFn = CATEGORY_FILTERS[category] ?? (() => true)
    return safeDeals.filter(filterFn)
  }, [safeDeals, category])

  const totalPages = Math.ceil(gridDeals.length / DEALS_PER_PAGE)
  const pagedDeals = gridDeals.slice((page - 1) * DEALS_PER_PAGE, page * DEALS_PER_PAGE)

  function handleCategoryChange(cat) {
    setCategory(cat)
    setPage(1)
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <NavBar />
      <CategoryNav active={category} onChange={handleCategoryChange} />
      <div className="page-wrap">
        <main>
          <StudentHub />
          <PromoStrip deals={featuredDeals} />
          <div className="section-header">
            <h1 className="section-title">
              {category === 'Today' ? "Today's Deals" : `${category} Deals`}
            </h1>
            <span className="section-date">{today}</span>
            {!loading && gridDeals.length > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>
                {gridDeals.length} deals
              </span>
            )}
          </div>
          {loading ? (
            <div className="deals-loading">Loading live deals...</div>
          ) : gridDeals.length === 0 ? (
            <div className="deals-loading">
              {category === 'Today'
                ? 'No deals yet — check back soon.'
                : `No ${category} deals right now. Try another category.`}
            </div>
          ) : (
            <>
              <div className="deal-grid">
                {pagedDeals.map((deal) => (
                  <DealCard key={deal.id ?? Math.random()} deal={deal} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  marginTop: 28,
                  paddingBottom: 8,
                }}>
                  <button
                    onClick={() => { setPage(p => p - 1); scrollToTop() }}
                    disabled={page === 1}
                    style={{
                      padding: '7px 18px',
                      borderRadius: 8,
                      border: '0.5px solid var(--border-strong)',
                      background: page === 1 ? 'var(--bg-surface)' : '#fff',
                      color: page === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: page === 1 ? 'default' : 'pointer',
                      fontFamily: 'var(--font)',
                    }}
                  >
                    ← Prev
                  </button>

                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                    Page {page} of {totalPages}
                    <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>
                      ({(page - 1) * DEALS_PER_PAGE + 1}–{Math.min(page * DEALS_PER_PAGE, gridDeals.length)} of {gridDeals.length})
                    </span>
                  </span>

                  <button
                    onClick={() => { setPage(p => p + 1); scrollToTop() }}
                    disabled={page === totalPages}
                    style={{
                      padding: '7px 18px',
                      borderRadius: 8,
                      border: '0.5px solid var(--border-strong)',
                      background: page === totalPages ? 'var(--bg-surface)' : '#fff',
                      color: page === totalPages ? 'var(--text-tertiary)' : 'var(--text-primary)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: page === totalPages ? 'default' : 'pointer',
                      fontFamily: 'var(--font)',
                    }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </main>
        <AdSidebar />
      </div>
    </>
  )
}
