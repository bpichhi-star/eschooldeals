'use client'

import { useState, useEffect } from 'react'
import NavBar from '@/components/NavBar'
import CategoryNav from '@/components/CategoryNav'
import PromoStrip from '@/components/PromoStrip'
import DealCard from '@/components/DealCard'
import AdSidebar from '@/components/AdSidebar'
import StudentHub from '@/components/StudentHub'

function getToday() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function HomePage() {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const today = getToday()

  useEffect(() => {
    fetch('/api/deals')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.deals ?? [])
        setDeals(list)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <NavBar />
      <CategoryNav />

      <div className="page-wrap">
        <main>
          <div className="section-header">
            <h1 className="section-title">Today's Deals</h1>
            <span className="section-date">{today}</span>
          </div>

          <PromoStrip deals={deals} />

          {loading ? (
            <div className="deals-loading">Loading live deals...</div>
          ) : deals.length === 0 ? (
            <div className="deals-loading">No deals found. Try refreshing.</div>
          ) : (
            <div className="deal-grid">
              {deals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          )}

          <StudentHub />
        </main>

        <AdSidebar />
      </div>
    </>
  )
}
