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

function classifyDeal(title = '') {
  const t = title.toLowerCase()

  // 1. ACCESSORIES — checked first so laptop bags, phone cases etc. don't get
  //    misclassified by the Computers or Phones rules below.
  //    Headphones/earbuds/speakers intentionally excluded — they live in Electronics.
  if (/phone case|iphone case|galaxy case|samsung case|phone cover|phone holder|phone mount|phone stand|phone grip|pop socket|screen protector|tempered glass|privacy screen|laptop case|laptop stand|laptop riser|laptop sleeve|laptop bag|laptop skin|laptop cooler|notebook sleeve|notebook bag|usb.?c hub|usb hub|docking station|usb.?c cable|lightning cable|hdmi cable|ethernet cable|aux cable|charging cable|charging pad|wireless charger|wall charger|car charger|power bank|portable charger|battery pack|power strip|surge protector|extension cord|monitor stand|monitor mount|monitor arm|mouse pad|desk mat|keyboard cover|wrist rest|webcam cover|cable management|cable clip|memory card|sd card|flash drive|usb drive|thumb drive|hard drive enclosure|\bmouse\b|\bkeyboard\b|\bwebcam\b|microphone|\bmic\b|ring light|selfie stick|tripod|camera bag|camera strap|lens cap|lens filter|adapter|dongle|converter|splitter/.test(t)) return 'Accessories'

  // 2. COMPUTERS — actual computing devices
  if (/\blaptop\b|\bnotebook\b|macbook|chromebook|desktop pc|desktop computer|all.?in.?one pc|\bmini pc\b|pc tower|workstation|\bimac\b|gaming laptop|gaming pc|ultrabook/.test(t)) return 'Computers'

  // 3. PHONES — actual handsets only
  if (/iphone \d|iphone (pro|plus|max|mini)|samsung galaxy [a-z0-9]|google pixel \d|motorola (moto|edge|razr)|oneplus \d|nothing phone|unlocked (phone|smartphone)|\bcell phone\b|refurbished iphone|refurbished samsung|android phone|5g smartphone/.test(t)) return 'Phones'

  // 4. ELECTRONICS — headphones, earbuds, speakers, TVs, tablets, cameras, gaming, wearables
  if (/headphones|over.?ear|on.?ear|noise.?cancelling|\bearbuds\b|\bearphones\b|in.?ear|true wireless|airpods|galaxy buds|\bbeats\b|\bbose\b|\bjabra\b|portable speaker|bluetooth speaker|soundbar|home theater|subwoofer|\btv\b|television|oled|qled|4k tv|8k tv|smart tv|projector|mirrorless|\bdslr\b|\bgopro\b|action camera|\bdrone\b|\bps5\b|playstation 5|xbox series|nintendo switch|gaming console|steam deck|smart home|echo dot|alexa|google home|ring doorbell|security camera|baby monitor|fire stick|apple tv|chromecast|\broku\b|smartwatch|smart watch|apple watch|galaxy watch|fitness tracker|garmin|fitbit|\bkindle\b|e.?reader|\btablet\b|\bipad\b|graphic tablet|\bmonitor\b|gaming monitor|ultrawide|portable monitor|graphing calculator/.test(t)) return 'Electronics'

  // 5. HOME
  if (/vacuum|robot vacuum|air purifier|humidifier|space heater|\bblender\b|toaster|coffee maker|espresso|keurig|air fryer|instant pot|pressure cooker|microwave|rice cooker|food processor|stand mixer|desk lamp|led strip|smart bulb|smart plug|thermostat|smart lock|paper shredder|dehumidifier|mini fridge|mattress|comforter|bed sheet|blanket|shower|bath mat|storage bin|\bshelf\b|bookcase|dresser|nightstand|sofa|\bcouch\b|recliner|office chair|standing desk|laundry hamper|shower caddy|tv stand|entertainment center/.test(t)) return 'Home'

  // 6. FASHION
  if (/\bshirt\b|\btee\b|t-shirt|\bjeans\b|\bjacket\b|\bhoodie\b|sweatshirt|\bsneakers\b|running shoes|dress shoes|\bboots\b|\bsandals\b|\bhat\b|\bbeanie\b|sunglasses|\bwallet\b|\bhandbag\b|\bpurse\b|\bbelt\b|swimwear|swimsuit|pajama|\bscarf\b|\bgloves\b|clothing|apparel/.test(t)) return 'Fashion'

  // 7. SPORTS
  if (/dumbbell|barbell|kettlebell|resistance band|treadmill|stationary bike|yoga mat|foam roller|gym bag|protein powder|pre.?workout|basketball|football|tennis racket|golf club|boxing|cycling|\bbike\b|skateboard|hiking boot|camping tent|fishing rod|kayak|jump rope|sports bra|workout equipment|home gym/.test(t)) return 'Sports'

  return 'General'
}

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

  const featuredDeals = safeDeals
    .filter(d => d.isFeatured)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 6)

  const gridDeals = useMemo(() => {
    let list = safeDeals
    if (category !== 'Today') {
      list = list.filter(d => classifyDeal(d.title) === category)
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
