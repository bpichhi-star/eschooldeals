'use client'

export default function NavBar() {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <a href="/" className="logo">
          e<span>S</span>chool<span>D</span>eals
        </a>

        <div className="searchbar">
          <input placeholder="Search deals..." />
        </div>

        <button className="alert-btn">Get Alerts</button>
      </div>
    </header>
  )
}
