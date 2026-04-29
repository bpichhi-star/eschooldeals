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

// Category nav filter: trust the server-assigned `category` field on each deal
// (set by lib/utils/categorize.js during ingest). We used to re-classify
// client-side from the title, but that meant any tweak to the rules required
// a code deploy, AND the client-side rules drifted out of sync with the
// canonical ones. The server is authoritative — admin-edited categories now
// stick, and updates to lib/utils/categorize.js take effect immediately.

export default function HomePage() {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('Today')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const today = getToday()

  useEffect(() => {
    fetch('/api/deals')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setDeals(data)
        else if (Array.isArray(data?.deals)) setDeals(data.deals)
        else setDeals([])
      })
      .catch(() => setDeals([]))
      .finally(() => setLoading(false))
  }, [])

  const safeDeals = Array.isArray(deals) ? deals : []

  // ESD strip: respect manual sort_order set by admin (lower = higher position).
  // Falls back to discount_pct DESC when sort_order is null. Caps at 6.
  const featuredDeals = safeDeals
    .filter(d => d.isFeatured)
    .sort((a, b) => {
      const aHas = a.sortOrder != null
      const bHas = b.sortOrder != null
      if (aHas && bHas) return a.sortOrder - b.sortOrder
      if (aHas) return -1
      if (bHas) return 1
      return (b.discountPct ?? 0) - (a.discountPct ?? 0)
    })
    .slice(0, 6)

  const gridDeals = useMemo(() => {
    let list = safeDeals
    if (category !== 'Today') {
      list = list.filter(d => (d.category || 'General') === category)
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(d =>
        (d.title || '').toLowerCase().includes(q) ||
        (d.merchant || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [safeDeals, category, search])

  const totalPages = Math.ceil(gridDeals.length / DEALS_PER_PAGE)
  const pagedDeals = gridDeals.slice((page - 1) * DEALS_PER_PAGE, page * DEALS_PER_PAGE)

  function handleCategoryChange(cat) {
    setCategory(cat)
    setPage(1)
  }

  function handleSearch(q) {
    setSearch(q)
    setPage(1)
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <NavBar onSearch={handleSearch} />
      <CategoryNav active={category} onChange={handleCategoryChange} />
      <div className="page-wrap">
        <main>
          <StudentHub />
          <PromoStrip deals={featuredDeals} />
          <div className="section-header">
            <h1 className="section-title">
              {search
                ? `Results for "${search}"`
                : category === 'Today'
                  ? "Today's Deals"
                  : `${category} Deals`}
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
          ) : gridDeals.length === 0 ? null : (
            <>
              <div className="deal-grid">
                {pagedDeals.map((deal) => (
                  <DealCard key={deal.id ?? Math.random()} deal={deal} />
                ))}
              </div>

              {totalPages > 1 && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginTop:28, paddingBottom:8 }}>
                  <button
                    onClick={() => { setPage(p => p - 1); scrollToTop() }}
                    disabled={page === 1}
                    style={{ padding:'7px 18px', borderRadius:8, border:'0.5px solid var(--border-strong)', background: page===1?'var(--bg-surface)':'#fff', color: page===1?'var(--text-tertiary)':'var(--text-primary)', fontSize:13, fontWeight:600, cursor:page===1?'default':'pointer', fontFamily:'var(--font)' }}>
                    ← Prev
                  </button>
                  <span style={{ fontSize:12, color:'var(--text-secondary)', fontWeight:500 }}>
                    Page {page} of {totalPages}
                    <span style={{ color:'var(--text-tertiary)', marginLeft:6 }}>({(page-1)*DEALS_PER_PAGE+1}–{Math.min(page*DEALS_PER_PAGE, gridDeals.length)} of {gridDeals.length})</span>
                  </span>
                  <button
                    onClick={() => { setPage(p => p + 1); scrollToTop() }}
                    disabled={page === totalPages}
                    style={{ padding:'7px 18px', borderRadius:8, border:'0.5px solid var(--border-strong)', background: page===totalPages?'var(--bg-surface)':'#fff', color: page===totalPages?'var(--text-tertiary)':'var(--text-primary)', fontSize:13, fontWeight:600, cursor:page===totalPages?'default':'pointer', fontFamily:'var(--font)' }}>
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
