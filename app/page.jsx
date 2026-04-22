import NavBar from '@/components/NavBar'
import CategoryNav from '@/components/CategoryNav'
import PromoStrip from '@/components/PromoStrip'
import DealCard from '@/components/DealCard'
import AdSidebar from '@/components/AdSidebar'
import { categories } from '@/lib/deals'
import { getHomepageDeals } from '@/lib/queries/getHomepageDeals'

export const dynamic = 'force-dynamic'

function getToday() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function HomePage() {
  const today = getToday()
  const visibleCategories = categories.slice(0, 10)
  const allDeals = await getHomepageDeals()

  return (
    <>
      <NavBar />
      <CategoryNav
        categories={visibleCategories}
        activeCategory="Today"
        onSelectCategory={() => {}}
      />

      <section className="search-row" aria-label="Search deals">
        <form className="search-row-inner">
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
              disabled
            />
          </div>

          <button className="alert-btn" type="button">
            Search
          </button>
        </form>
      </section>

      <div className="page-wrap">
        <main>
          <div className="section-header">
            <h1 className="section-title">Today's Deals</h1>
            <span className="section-date">{today}</span>
          </div>

          <PromoStrip deals={allDeals.slice(0, 4)} />

          {allDeals.length > 0 ? (
            <div className="deal-grid">
              {allDeals.map((deal) => (
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
