'use client'

import { useEffect, useState } from 'react'

/** A number that counts up to its value (and to each new value) with an ease-out; still under reduced motion. */
export function CountUp({ value, ms = 900 }: { value: number; ms?: number }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    let frame = 0
    const start = performance.now()
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    const from = 0
    const tick = (now: number) => {
      const k = still ? 1 : Math.min(1, (now - start) / ms)
      setShown(from + (value - from) * (1 - (1 - k) ** 3))
      if (k < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, ms])
  const digits = Number.isInteger(value) ? 0 : 1
  return <>{shown.toFixed(digits)}</>
}
