'use client'
import { useState } from 'react'
import { categories } from '@/lib/deals'

export default function CategoryNav() {
  const [active, setActive] = useState('Today')

  return (
    <nav className="cat-nav" aria-label="Deal categories">
      <div className="cat-nav-inner">
        {categories.map((cat) => (
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
