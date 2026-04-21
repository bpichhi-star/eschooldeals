import NavBar from '@/components/NavBar'
import CategoryNav from '@/components/CategoryNav'
import PromoStrip from '@/components/PromoStrip'
import DealCard from '@/components/DealCard'
import AdSidebar from '@/components/AdSidebar'
import { deals } from '@/lib/deals'

function getToday() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function HomePage() {
  const today = getToday()

  return (
    <>
      <NavBar />
      <CategoryNav />

      <div style={{ background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
        <div
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '10px 24px 12px',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          <div className="searchbar" style={{ flex: 1 }}>
            <input placeholder="Search deals, stores, products..." />
          </div>

          <button className="alert-btn" style={{ minWidth: '120px' }}>
            Search
          </button>
        </div>
      </div>

      <div className="page-wrap">
        <main>
          <div className="section-header">
            <h1 className="section-title">Today's Deals</h1>
            <span className="section-date">{today}</span>
          </div>

          <PromoStrip />

          <div className="deal-grid">
            {deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        </main>

        <AdSidebar />
      </div>
    </>
  )
}
