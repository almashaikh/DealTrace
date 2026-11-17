import { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  /** Turns the number into text, for example formatMoney. */
  format: (n: number) => string
  /** Milliseconds. Default 200. */
  duration?: number
  className?: string
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/** A figure that eases to its new value over 200 ms and always lands exactly on it. */
export function AnimatedNumber({ value, format, duration = 200, className }: AnimatedNumberProps) {
  const [shown, setShown] = useState(value)
  const shownRef = useRef(value)

  useEffect(() => {
    const from = shownRef.current
    const ms = prefersReducedMotion() ? 0 : duration
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = ms === 0 ? 1 : Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = t >= 1 ? value : from + (value - from) * eased
      shownRef.current = next
      setShown(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <span className={className}>{format(shown)}</span>
}
