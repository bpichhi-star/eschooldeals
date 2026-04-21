'use client'
import { useState } from 'react'
import { categories } from '@/lib/deals'

export default function CategoryNav() {
  const [active, setActive] = useState('Today')

  // limit to 10 categories max
  const visibleCategories = categories.slice(0, 10)

  return (
    <nav className="cat-nav" aria-label="Deal categories">
      <div className="cat-nav-inner">
        {visibleCategories.map((cat) => (
          <button
            key={cat}
            className={`cat-item${active === cat ? ' active' : ''}`}
            onClick={() => setActive(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
    </nav>
  )
}
