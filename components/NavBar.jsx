'use client'

export default function NavBar() {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <a href="/" className="logo">
          e<span>S</span>chool<span>D</span>eals
        </a>

        <div className="searchbar">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="#aeaeb2" strokeWidth="1.5" />
            <line x1="10" y1="10" x2="14.5" y2="14.5" stroke="#aeaeb2" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search deals, stores, products..."
            aria-label="Search deals"
          />
          <button className="search-btn">Search</button>
        </div>
      </div>
    </header>
  )
}
