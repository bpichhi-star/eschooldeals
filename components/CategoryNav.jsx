'use client'
import { useState } from 'react'

const CATEGORIES = ['Today','Electronics','Computers','Phones','Home','Kitchen','Fashion','Sports','Travel','Toys']

export default function CategoryNav() {
  const [active, setActive] = useState('Today')

  return (
    <nav className="cat-nav" aria-label="Deal categories">
      <div className="cat-nav-inner">
        {CATEGORIES.map((cat) => (
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
