'use client'
import { useRef } from 'react'

export default function NavBar({ onSearch }) {
  const inputRef = useRef(null)

  function handleSubmit(e) {
    e.preventDefault()
    onSearch?.(inputRef.current?.value?.trim() ?? '')
  }

  function handleChange(e) {
    onSearch?.(e.target.value.trim())
  }

  function handleClear() {
    if (inputRef.current) inputRef.current.value = ''
    onSearch?.('')
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <a href="/" className="logo">
          e<span>S</span>chool<span>D</span>eals
        </a>
        <form className="searchbar" onSubmit={handleSubmit}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="#aeaeb2" strokeWidth="1.5" />
            <line x1="10" y1="10" x2="14.5" y2="14.5" stroke="#aeaeb2" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search deals, brands, products..."
            aria-label="Search deals"
            onChange={handleChange}
          />
          <button type="button" onClick={handleClear} className="search-clear" aria-label="Clear search">✕</button>
          <button type="submit" className="search-btn">Search</button>
        </form>
        <nav style={{ display:'flex', alignItems:'center', gap:16, marginLeft:12, flexShrink:0 }}>
          <a
            href="/archive"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-secondary, #6b7280)',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
            }}
          >
            📅 Deal Archive
          </a>
        </nav>
      </div>
    </header>
  )
}
