'use client'
import { useState, useEffect } from 'react'
import NavBar from '@/components/NavBar'
import DealCard from '@/components/DealCard'

// Past 7 days including today
function getLast7Days() {
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })) // YYYY-MM-DD
  }
  return days
}

function formatDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const yesterday = new Date(Date.now() - 864e5).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  if (dateStr === today)     return { label: 'Today', sub: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
  if (dateStr === yesterday) return { label: 'Yesterday', sub: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
  return {
    label: d.toLocaleDateString('en-US', { weekday: 'long' }),
    sub:   d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }
}

export default function ArchivePage() {
  const days = getLast7Days()
  const [selectedDate, setSelectedDate] = useState(days[0])
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    setDeals([])
    setCount(null)
    fetch('/api/deals/archive?date=' + selectedDate)
      .then(r => r.json())
      .then(data => {
        setDeals(Array.isArray(data.deals) ? data.deals : [])
        setCount(data.count ?? 0)
      })
      .catch(() => setDeals([]))
      .finally(() => setLoading(false))
  }, [selectedDate])

  const filtered = search
    ? deals.filter(d => (d.title || '').toLowerCase().includes(search.toLowerCase()) || (d.merchant || '').toLowerCase().includes(search.toLowerCase()))
    : deals

  return (
    <>
      <NavBar onSearch={setSearch} />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', fontFamily: 'var(--font)' }}>
            Deal Archive
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            Browse deals from the past 7 days
          </p>
        </div>

        {/* Calendar strip */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, overflowX: 'auto', paddingBottom: 4 }}>
          {days.map(date => {
            const { label, sub } = formatDay(date)
            const isSelected = date === selectedDate
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                style={{
                  flex: '0 0 auto',
                  minWidth: 90,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: isSelected ? '2px solid var(--accent, #1a1a2e)' : '1px solid var(--border, #e5e7eb)',
                  background: isSelected ? 'var(--accent, #1a1a2e)' : '#fff',
                  color: isSelected ? '#fff' : 'var(--text-primary, #111)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontFamily: 'var(--font)',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 11, opacity: 0.75 }}>{sub}</div>
              </button>
            )
          })}
        </div>

        {/* Deal count */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font)' }}>
            {loading
              ? 'Loading...'
              : count !== null
                ? count + ' deal' + (count !== 1 ? 's' : '') + ' for ' + formatDay(selectedDate).label
                : ''}
          </span>
          {search && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Showing {filtered.length} matching "{search}"
            </span>
          )}
        </div>

        {/* Deals grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontFamily: 'var(--font)', fontSize: 14 }}>
            Loading deals...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontFamily: 'var(--font)', fontSize: 14 }}>
            {count === 0 ? 'No deals archived for this day yet.' : 'No deals match your search.'}
          </div>
        ) : (
          <div className="deal-grid">
            {filtered.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
