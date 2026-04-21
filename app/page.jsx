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

      <section className="search-row" aria-label="Search deals">
        <div className="search-row-inner">
          <div className="searchbar">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="#aeaeb2" strokeWidth="1.5" />
              <line x1="10" y1="10" x2="14.5" y2="14.5" stroke="#aeaeb2" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search deals, stores, products..."
              aria-label="Search deals"
            />
          </div>

          <button className="alert-btn">
            Search
          </button>
        </div>
      </section>

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
