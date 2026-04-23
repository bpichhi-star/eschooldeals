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
  }).toUpperCase()
}

export default function HomePage() {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
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

  return (
    <>
      <NavBar />
      <CategoryNav />

      {/* FEATURED strip comes first */}
      <PromoStrip deals={safeDeals} />

      <div className="page-wrap">
        <main>
          {/* Today's Deals header sits BELOW the featured strip */}
          <div className="section-header">
            <h1 className="section-title">Today's Deals</h1>
            <span className="section-date">{today}</span>
          </div>

          {loading ? (
            <div className="deals-loading">Loading live deals...</div>
          ) : safeDeals.length === 0 ? (
            <div className="deals-loading">No deals found. Try refreshing.</div>
          ) : (
            <div className="deal-grid">
              {safeDeals.map((deal) => (
                <DealCard key={deal.id ?? deal.asin ?? Math.random()} deal={deal} />
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
