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
  Today: () => true,

  // TVs, audio, cameras, gaming consoles, smart home — NOT computers or accessories
  Electronics: d =>
    d.category === 'Electronics' ||
    /\b(tv|television|oled|qled|4k display|projector|camera|mirrorless|dslr|drone|speaker|soundbar|home theater|gaming console|ps5|playstation|xbox|nintendo switch|smart home|echo|alexa|google home|ring|nest|security camera|baby monitor|dash cam|action cam|gopro|streaming|fire stick|apple tv|chromecast|roku|smart watch|smartwatch|fitness tracker|garmin|fitbit|e-reader|kindle|tablet|ipad)\b/i.test(d.title),

  // Laptops, desktops, all-in-ones only
  Computers: d =>
    d.category === 'Computers' ||
    /\b(laptop|notebook|macbook|chromebook|desktop|all.?in.?one|aio|mini pc|pc tower|workstation|imac|gaming pc|gaming laptop|ultrabook)\b/i.test(d.title),

  // All accessories: cables, cases, chargers, mounts, peripherals
  Accessories: d =>
    d.category === 'Accessories' ||
    /\b(cable|usb|usb.c|lightning|hdmi|charger|charging|power bank|adapter|hub|docking station|mouse|keyboard|webcam|headset|microphone|monitor|screen protector|phone case|laptop bag|laptop stand|monitor arm|wall mount|surge protector|extension cord|memory card|sd card|flash drive|ssd|external drive|earbuds|earphones|airpods|headphones|neckband|wired earphone|bluetooth speaker|portable speaker)\b/i.test(d.title),

  // Unlocked cell phones only
  Phones: d =>
    d.category === 'Phones' ||
    /\b(iphone|samsung galaxy|google pixel|motorola moto|oneplus|nothing phone|unlocked (phone|smartphone|5g)|cell phone|refurbished iphone|refurbished samsung|pixel [0-9])\b/i.test(d.title),

  // Small appliances, robot vacuums, smart home appliances, small kitchen
  Home: d =>
    d.category === 'Home' ||
    /\b(vacuum|robot vacuum|air purifier|humidifier|diffuser|fan|space heater|iron|steamer|blender|toaster|coffee maker|espresso|keurig|air fryer|instant pot|pressure cooker|microwave|kettle|rice cooker|food processor|mixer|waffle|juicer|lamp|desk lamp|led strip|smart bulb|smart plug|thermostat|doorbell|door lock|safe|shredder)\b/i.test(d.title),

  // Clothing and wearable fashion
  Fashion: d =>
    d.category === 'Fashion' ||
    /\b(shirt|tee|t-shirt|jeans|denim|jacket|coat|hoodie|sweatshirt|sweater|dress|skirt|pants|shorts|leggings|activewear|athleisure|sneaker|shoe|boot|sandal|slipper|hat|beanie|cap|sunglasses|watch|wallet|handbag|backpack|crossbody|belt|socks|underwear|bra|swimwear|swimsuit|pajama|lounge|cardigan|blazer|suit|tie|scarf|gloves)\b/i.test(d.title),

  // Sports gear and equipment
  Sports: d =>
    d.category === 'Sports' ||
    /\b(dumbbell|barbell|kettlebell|weight|resistance band|pull.?up bar|bench press|squat rack|treadmill|stationary bike|elliptical|rowing machine|yoga mat|foam roller|gym bag|protein|pre.?workout|creatine|basketball|football|soccer|baseball|tennis|golf|hockey|boxing|mma|cycling|bike|helmet|skateboard|longboard|scooter|hiking|camping|fishing|hunting|kayak|paddleboard|swim|running shoe|trail shoe|climbing|jump rope|plyo|sports bra|compression|athletic)\b/i.test(d.title),
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

  const featuredDeals = safeDeals
    .filter(d => d.isFeatured)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 6)

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

              {totalPages > 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 12, marginTop: 28, paddingBottom: 8,
                }}>
                  <button
                    onClick={() => { setPage(p => p - 1); scrollToTop() }}
                    disabled={page === 1}
                    style={{
                      padding: '7px 18px', borderRadius: 8, border: '0.5px solid var(--border-strong)',
                      background: page === 1 ? 'var(--bg-surface)' : '#fff',
                      color: page === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                      fontSize: 13, fontWeight: 600, cursor: page === 1 ? 'default' : 'pointer',
                      fontFamily: 'var(--font)',
                    }}
                  >← Prev</button>

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
                      padding: '7px 18px', borderRadius: 8, border: '0.5px solid var(--border-strong)',
                      background: page === totalPages ? 'var(--bg-surface)' : '#fff',
                      color: page === totalPages ? 'var(--text-tertiary)' : 'var(--text-primary)',
                      fontSize: 13, fontWeight: 600, cursor: page === totalPages ? 'default' : 'pointer',
                      fontFamily: 'var(--font)',
                    }}
                  >Next →</button>
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
