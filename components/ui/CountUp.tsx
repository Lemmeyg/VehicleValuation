'use client'

import { useEffect, useRef, useState } from 'react'

interface CountUpProps {
  to: number
  prefix?: string
  suffix?: string
  comma?: boolean
  durationMs?: number
}

function shouldSkipAnimation(): boolean {
  if (typeof window === 'undefined') return false
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return reduceMotion || typeof IntersectionObserver === 'undefined'
}

/**
 * Counts up from 0 to `to` the first time it scrolls into view, then holds.
 * Self-contained (own IntersectionObserver) so it can sit inside a Reveal
 * wrapper or stand alone. Skips the animation and shows the final value
 * immediately under reduced motion.
 */
export function CountUp({
  to,
  prefix = '',
  suffix = '',
  comma = false,
  durationMs = 1000,
}: CountUpProps) {
  const [skipAnimation] = useState(shouldSkipAnimation)
  const [value, setValue] = useState(() => (skipAnimation ? to : 0))
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    if (skipAnimation) return
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting && !started.current) {
            started.current = true
            const start = performance.now()
            const frame = (now: number) => {
              const progress = Math.min((now - start) / durationMs, 1)
              const eased = 1 - Math.pow(1 - progress, 3)
              setValue(Math.round(to * eased))
              if (progress < 1) requestAnimationFrame(frame)
            }
            requestAnimationFrame(frame)
            observer.disconnect()
          }
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, durationMs])

  const display = comma ? value.toLocaleString('en-US') : String(value)
  return (
    <span ref={ref}>
      {prefix}
      {display}
      {suffix}
    </span>
  )
}
