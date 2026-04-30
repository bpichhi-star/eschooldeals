// Shared sort logic used by both the homepage grid (app/page.jsx) and the
// archive page (app/archive/page.jsx) so they offer the same sort options
// and produce the same ordering. Default is 'latest'.
//
//   latest      → newest first, by createdAt DESC. Matches server default.
//   price-asc   → cheapest first
//   price-desc  → most expensive first
//   discount    → biggest % off first
//   savings     → biggest absolute dollar amount saved first. More honest
//                 than discount % for budget-conscious buyers (80% off a
//                 $5 widget < 25% off a $400 laptop in real-money terms).
//   clicks      → most clicked first (uses deals.clickCount populated by
//                 /api/track-click). Cold-start tiebreaker is createdAt.
//
// Sorts are applied to the FILTERED list, so they always reflect what the
// user is currently viewing.
export const SORT_OPTIONS = [
  { value: 'latest',     label: 'Latest first' },
  { value: 'price-asc',  label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'clicks',     label: 'Most clicked' },
  { value: 'discount',   label: 'Biggest discount %' },
  { value: 'savings',    label: 'Most savings $' },
]

export function sortDeals(list, sortBy) {
  // Don't mutate the caller's array.
  const sorted = [...list]
  switch (sortBy) {
    case 'price-asc':
      sorted.sort((a, b) => (a.salePrice ?? Infinity) - (b.salePrice ?? Infinity))
      break
    case 'price-desc':
      sorted.sort((a, b) => (b.salePrice ?? -Infinity) - (a.salePrice ?? -Infinity))
      break
    case 'discount':
      sorted.sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0))
      break
    case 'savings': {
      // Compute on the fly (we don't store savings in the DB; it's derived).
      // Tiebreak on discount % so two items with the same dollar savings show
      // the more aggressive % off first.
      const savings = (d) => Math.max(0, (d.originalPrice ?? 0) - (d.salePrice ?? 0))
      sorted.sort((a, b) => (savings(b) - savings(a)) || ((b.discountPct ?? 0) - (a.discountPct ?? 0)))
      break
    }
    case 'clicks':
      // Items never clicked have clickCount=0; they pile up at the bottom.
      // Tiebreak by createdAt DESC so newer no-click items beat older.
      sorted.sort((a, b) => {
        const diff = (b.clickCount ?? 0) - (a.clickCount ?? 0)
        if (diff !== 0) return diff
        return (b.createdAt || '').localeCompare(a.createdAt || '')
      })
      break
    case 'latest':
    default:
      sorted.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      break
  }
  return sorted
}
