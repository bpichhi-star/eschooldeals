'use client'
import { useState, useEffect, useMemo } from 'react'
import NavBar from '@/components/NavBar'
import CategoryNav from '@/components/CategoryNav'
import PromoStrip from '@/components/PromoStrip'
import DealCard from '@/components/DealCard'
import AdSidebar from '@/components/AdSidebar'
import StudentHub from '@/components/StudentHub'
import BackToTop from '@/components/BackToTop'

function getToday() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).toUpperCase()
}

const DEALS_PER_PAGE = 50

// Category nav filter: trust the server-assigned `category` field on each deal
// (set by lib/utils/categorize.js during ingest). We used to re-classify
// client-side from the title, but that meant any tweak to the rules required
// a code deploy, AND the client-side rules drifted out of sync with the
// canonical ones. The server is authoritative — admin-edited categories now
// stick, and updates to lib/utils/categorize.js take effect immediately.

// Search synonyms: when a search token matches one of these, we filter by the
// mapped category rather than doing a substring match. Catches the case where
// a user types "computer" or "laptop" expecting to see the Computers tab's
// contents — without this, the substring match returns USB-C laptop chargers
// (Accessories) and items mentioning "computer" in passing.
//
// Scope is intentionally narrow: only true category-name words and the most
// common device-class aliases (laptop, macbook, ipad, etc.). Item-type words
// like "headphones", "vacuum", "hoodie" are NOT synonyms — they substring-
// match titles directly, so "headphones" returns only items whose titles say
// "headphones", not every Accessories item.
//
// Two safety behaviors handle edge cases:
//   1. Conflict (e.g. "iphone case" → Phones + Accessories) → fall back to
//      pure substring across all tokens.
//   2. Empty result after narrowing (e.g. "iphone" when Phones is empty)
//      → retry with substring across all tokens. Means searching for an
//      iPhone surfaces iPhone cases when no actual phones are listed.
const CATEGORY_SYNONYMS = {
  // Computers — laptops, desktops, all-in-ones, tablets/iPads
  computer: 'Computers',  computers: 'Computers',
  laptop:   'Computers',  laptops:   'Computers',
  desktop:  'Computers',  desktops:  'Computers',
  macbook:  'Computers',  macbooks:  'Computers',
  chromebook: 'Computers', chromebooks: 'Computers',
  ultrabook: 'Computers',
  imac: 'Computers',      imacs: 'Computers',
  ipad: 'Computers',      ipads: 'Computers',
  tablet: 'Computers',    tablets: 'Computers',
  pc: 'Computers',        pcs: 'Computers',

  // Phones — actual handsets only
  phone:      'Phones',   phones:      'Phones',
  smartphone: 'Phones',   smartphones: 'Phones',
  iphone:     'Phones',   iphones:     'Phones',

  // Accessories — only the literal category name
  accessory: 'Accessories', accessories: 'Accessories',

  // Electronics
  electronics: 'Electronics',

  // Home
  home: 'Home',

  // Fashion
  fashion: 'Fashion',

  // Sports
  sports: 'Sports',
}

// Generate singular/plural variants of a free-text search token so that
// typing "cases" matches titles containing "case" (and vice versa). Returns
// an array of lowercase strings to OR-match against the haystack.
//
// Rules (intentionally simple — false-positive variants like "phonees" are
// harmless because they just don't match anything; false negatives are what
// users actually feel):
//   - Toggle trailing 's'   (case ↔ cases, charger ↔ chargers)
//   - 'ies' ↔ 'y'           (batteries ↔ battery)
//   - 'es' plural strip ONLY for stems ending in sibilant clusters
//                            (boxes → box, glasses → glass, watches → watch).
//                            'cases' deliberately does NOT match this rule —
//                            its stem 'cas' would falsely match "casual",
//                            "cash", "casters" — so it falls through to the
//                            simple trailing-'s' toggle.
//   - Skip stemming for tokens shorter than 3 chars (avoids 'tv' → 't')
//   - Strip leading/trailing punctuation (case. / case, / "case" all work)
function tokenVariants(raw) {
  // Strip surrounding punctuation but keep internal hyphens/apostrophes
  // (so "cat-6" and "men's" survive intact).
  const token = raw.replace(/^[^a-z0-9]+|[^a-z0-9'-]+$/gi, '')
  if (token.length < 3) return [token]
  const v = new Set([token])
  // ies ↔ y  (batteries ↔ battery)
  if (token.endsWith('ies')) v.add(token.slice(0, -3) + 'y')
  else if (token.endsWith('y')) v.add(token.slice(0, -1) + 'ies')
  // 'es' plural strip — only when the stem ends in a sibilant cluster.
  // English uses '-es' plurals when the singular ends in [s, x, z, ch, sh]:
  //   box → boxes, dress → dresses, glass → glasses, watch → watches,
  //   ranch → ranches.
  // 'cases' does NOT qualify because the stem 'cas' ends in single 's',
  // not 'ss', so we don't accidentally generate the 'cas' variant.
  if (token.endsWith('es') && token.length > 4) {
    const stem = token.slice(0, -2)
    if (/(?:[xz]|ss|ch|sh)$/.test(stem)) v.add(stem)
  }
  // Toggle trailing single 's' for simple plurals (case ↔ cases)
  if (token.endsWith('s')) v.add(token.slice(0, -1))
  else v.add(token + 's')
  return [...v]
}

import { SORT_OPTIONS, sortDeals } from '@/lib/utils/dealSort'

export default function HomePage() {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('Today')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  // Default sort = latest first (matches the server-side ORDER BY but the
  // client re-sorts whenever this changes, so the dropdown is responsive).
  const [sortBy, setSortBy] = useState('latest')
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

  // ESD strip: respect manual sort_order set by admin (lower = higher position).
  // Falls back to discount_pct DESC when sort_order is null. Caps at 6.
  const featuredDeals = safeDeals
    .filter(d => d.isFeatured)
    .sort((a, b) => {
      const aHas = a.sortOrder != null
      const bHas = b.sortOrder != null
      if (aHas && bHas) return a.sortOrder - b.sortOrder
      if (aHas) return -1
      if (bHas) return 1
      return (b.discountPct ?? 0) - (a.discountPct ?? 0)
    })
    .slice(0, 6)

  const gridDeals = useMemo(() => {
    // When the user is searching, ignore the category tab — search runs across
    // every active deal. Otherwise, apply the category filter as before.
    if (search) {
      const tokens = search.toLowerCase().split(/\s+/).filter(Boolean)

      // Step 1: classify each token as either a category synonym or a
      // free-text token. If the user typed a word like "computer" or
      // "laptop", we'll filter by the Computers category instead of doing
      // a substring match against titles.
      const synonymCategories = new Set()
      const freeTokens = []
      for (const t of tokens) {
        const cat = CATEGORY_SYNONYMS[t]
        if (cat) synonymCategories.add(cat)
        else     freeTokens.push(t)
      }

      // Step 2: decide whether to apply a category filter.
      //   - 0 synonym categories → no narrowing, all tokens are free-text
      //   - 1 synonym category   → narrow to that category, free tokens
      //                            still substring-match
      //   - 2+ different cats    → conflict (e.g. "iphone case"). Fall back
      //                            to pure substring across all tokens so
      //                            cross-category searches still work.
      let filterCategory = null
      let substringTokens = freeTokens
      if (synonymCategories.size === 1) {
        filterCategory = [...synonymCategories][0]
      } else if (synonymCategories.size > 1) {
        substringTokens = tokens  // every token (incl. synonyms) substring-matches
      }

      // Helper that runs the actual filter with current settings.
      // Each substring token is expanded to plural/singular variants — typing
      // "cases" matches titles containing "case" and vice versa.
      const runFilter = (cat, subTokens) => {
        const variantSets = subTokens.map(tokenVariants)
        return safeDeals.filter(d => {
          if (cat && (d.category || 'General') !== cat) return false
          if (variantSets.length === 0) return true
          const hay = (
            (d.title || '') + ' ' +
            (d.merchant || '') + ' ' +
            (d.category || '')
          ).toLowerCase()
          // Every token group must have at least one variant present.
          return variantSets.every(variants => variants.some(v => hay.includes(v)))
        })
      }

      let results = runFilter(filterCategory, substringTokens)

      // Auto-fallback: if narrowing yielded zero results, retry with all
      // tokens as substring match (no category filter). Means searching
      // "iphone case" still surfaces cases even when Phones is empty.
      if (results.length === 0 && filterCategory) {
        results = runFilter(null, tokens)
      }

      return sortDeals(results, sortBy)
    }
    let list = safeDeals
    if (category !== 'Today') {
      list = list.filter(d => (d.category || 'General') === category)
    }
    return sortDeals(list, sortBy)
  }, [safeDeals, category, search, sortBy])

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
              <>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {gridDeals.length} deals
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value); setPage(1) }}
                  aria-label="Sort deals"
                  className="sort-select"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </>
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
      <BackToTop />
    </>
  )
}
