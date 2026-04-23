'use client'

import { useEffect, useMemo, useState } from 'react'
import NavBar from '@/components/NavBar'
import CategoryNav from '@/components/CategoryNav'
import PromoStrip from '@/components/PromoStrip'
import DealCard from '@/components/DealCard'
import AdSidebar from '@/components/AdSidebar'
import { categories } from '@/lib/deals'

function getToday() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function HomePage() {
  const visibleCategories = categories.slice(0, 10)

  const [activeCategory, setActiveCategory] = useState('Today')
  const [draftQuery, setDraftQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [allDeals, setAllDeals] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [today, setToday] = useState('')

  useEffect(() => {
    let isMounted = true
    setToday(getToday())

    async function loadDeals() {
      try {
        const res = await fetch(`/api/deals?t=${Date.now()}`, {
          cache: 'no-store',
        })

        if (!res.ok) {
          throw new Error('Failed to load deals')
        }

        const data = await res.json()

        if (!isMounted) return

        setAllDeals(Array.isArray(data?.deals) ? data.deals : [])
        setLoaded(true)
      } catch {
        if (!isMounted) return
        setAllDeals([])
        setLoaded(true)
      }
    }

    loadDeals()

    return () => {
      isMounted = false
    }
  }, [])

  const filteredDeals = useMemo(() => {
    return allDeals.filter((deal) => {
      const matchesCategory =
        activeCategory === 'Today' || deal.category === activeCategory

      const q = searchQuery.trim().toLowerCase()
      const matchesSearch =
        q.length === 0 ||
        String(deal.title || '').toLowerCase().includes(q) ||
        String(deal.merchant || '').toLowerCase().includes(q) ||
        String(deal.category || '').toLowerCase().includes(q)

      return matchesCategory && matchesSearch
    })
  }, [activeCategory, searchQuery, allDeals])

  function handleSearchSubmit(e) {
    e.preventDefault()
    setSearchQuery(draftQuery)
  }

  return (
    <>
      <NavBar />
      <CategoryNav
        categories={visibleCategories}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
      />

      <section className="search-row" aria-label="Search deals">
        <form className="search-row-inner" onSubmit={handleSearchSubmit}>
          <div className="searchbar">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="#aeaeb2" strokeWidth="1.5" />
              <line
                x1="10"
                y1="10"
                x2="14.5"
                y2="14.5"
                stroke="#aeaeb2"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="text"
              placeholder="Search deals, stores, products..."
              aria-label="Search deals"
              value={draftQuery}
              onChange={(e) => setDraftQuery(e.target.value)}
            />
          </div>

          <button className="alert-btn" type="submit">
            Search
          </button>
        </form>
      </section>

      <div className="page-wrap">
        <main>
          <div className="section-header">
            <h1 className="section-title">
              {activeCategory === 'Today' ? "Today's Deals" : activeCategory}
            </h1>
            <span className="section-date">{today}</span>
          </div>

          <PromoStrip deals={allDeals.slice(0, 4)} />

          {!loaded ? (
            <div
              style={{
                background: '#fff',
                border: '0.5px solid rgba(0,0,0,0.07)',
                borderRadius: '11px',
                padding: '20px',
                fontSize: '13px',
                color: '#6e6e73',
              }}
            >
              Loading live deals...
            </div>
          ) : filteredDeals.length > 0 ? (
            <div className="deal-grid">
              {filteredDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          ) : (
            <div
              style={{
                background: '#fff',
                border: '0.5px solid rgba(0,0,0,0.07)',
                borderRadius: '11px',
                padding: '20px',
                fontSize: '13px',
                color: '#6e6e73',
              }}
            >
              No live deals found.
            </div>
          )}
        </main>

        <AdSidebar />
      </div>
    </>
  )
}
