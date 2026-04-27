'use client'

const CATEGORIES = [
  'Today', 'Electronics', 'Computers', 'Accessories', 'Phones', 'Home', 'Fashion', 'Sports',
]

export default function CategoryNav({ active = 'Today', onChange }) {
  return (
    <nav className="cat-nav" aria-label="Deal categories">
      <div className="cat-nav-inner">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`cat-item${active === cat ? ' active' : ''}`}
            onClick={() => onChange?.(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
    </nav>
  )
}

export { CATEGORIES }
