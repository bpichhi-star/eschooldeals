// lib/constants/categories.js
//
// Single source of truth for category labels.
// The site nav is canonical — admin form, admin filter, and feed parsers
// must all assign categories from this list.
//
// IMPORTANT: 'Today' is a virtual nav filter (shows recent deals across all
// categories), NOT an assignable category. 'All' is a filter UI option only.
// Neither should ever be written to the `category` column on a deal row.

export const CATEGORIES = [
  'Electronics',
  'Computers',
  'Accessories',
  'Phones',
  'Home',
  'Fashion',
  'Sports',
]

// Used by components/CategoryNav.jsx — the homepage tab strip
export const NAV_CATEGORIES = ['Today', ...CATEGORIES]

// Used by app/admin/page.jsx — the deals filter dropdown ('All' = show every category)
export const ADMIN_FILTER_CATEGORIES = ['All', ...CATEGORIES]
