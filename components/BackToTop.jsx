'use client'
import { useEffect, useState } from 'react'

// Fixed-position circular button at the bottom-right that scrolls the page
// back to the top. Hidden until the user has scrolled at least SHOW_AT_PX,
// then fades in. Smooth-scroll on click, respects prefers-reduced-motion.
const SHOW_AT_PX = 400

export default function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > SHOW_AT_PX)
    }
    onScroll() // initial state in case page loads scrolled
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleClick() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Scroll to top"
      title="Scroll to top"
      style={{
        position:        'fixed',
        bottom:          24,
        right:           24,
        width:           44,
        height:          44,
        borderRadius:    22,
        border:          '0.5px solid var(--border-strong)',
        background:      'var(--bg-card)',
        color:           'var(--text-primary)',
        boxShadow:       '0 4px 12px rgba(0, 0, 0, 0.12)',
        cursor:          'pointer',
        display:         'flex',
        alignItems:      'center',
        justifyContent: 'center',
        opacity:         visible ? 1 : 0,
        pointerEvents:   visible ? 'auto' : 'none',
        transform:       visible ? 'translateY(0)' : 'translateY(8px)',
        transition:      'opacity 180ms ease, transform 180ms ease',
        zIndex:          1000,
        padding:         0,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 13 L8 3 M3.5 7.5 L8 3 L12.5 7.5"
              stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
