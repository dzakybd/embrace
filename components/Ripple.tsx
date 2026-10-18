'use client'

import { useEffect } from 'react'

const TARGETS = 'button:not(:disabled), .chip, .filter, .role-card, .entry, .kb-card, .case-row, .tabs [role="tab"]'

/** Material ripple on press for buttons, chips, tabs and clickable cards: one listener for the whole app. */
export function Ripple() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const down = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(TARGETS)
      if (!el) return
      const r = el.getBoundingClientRect()
      const size = Math.max(r.width, r.height) * 2
      const dot = document.createElement('span')
      dot.className = 'ripple'
      dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
      el.classList.add('has-ripple')
      el.appendChild(dot)
      dot.addEventListener('animationend', () => dot.remove())
    }
    document.addEventListener('pointerdown', down)
    return () => document.removeEventListener('pointerdown', down)
  }, [])
  return null
}
