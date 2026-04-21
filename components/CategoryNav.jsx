'use client'

export default function CategoryNav({ categories, activeCategory, onSelectCategory }) {
  return (
    <nav className="cat-nav" aria-label="Deal categories">
      <div className="cat-nav-inner">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`cat-item${activeCategory === cat ? ' active' : ''}`}
            onClick={() => onSelectCategory(cat)}
            type="button"
          >
            {cat}
          </button>
        ))}
      </div>
    </nav>
  )
}
