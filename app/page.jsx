import NavBar from '@/components/NavBar'
import CategoryNav from '@/components/CategoryNav'
import PromoStrip from '@/components/PromoStrip'
import DealCard from '@/components/DealCard'
import AdSidebar from '@/components/AdSidebar'
import StudentHub from '@/components/StudentHub'
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

      <div className="page-wrap">

        {/* Main content */}
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

          <StudentHub />

        </main>

        {/* Ad sidebar */}
        <AdSidebar />

      </div>
    </>
  )
}
