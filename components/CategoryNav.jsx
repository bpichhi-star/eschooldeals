'use client'

const CATEGORIES = [
  'Today', 'Electronics', 'Computers', 'Phones',
  'Home', 'Kitchen', 'Fashion', 'Sports', 'Travel', 'Toys',
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
