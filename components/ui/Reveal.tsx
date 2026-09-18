'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  delayMs?: number
  className?: string
}

function shouldSkipReveal(): boolean {
  if (typeof window === 'undefined') return false
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return reduceMotion || typeof IntersectionObserver === 'undefined'
}

/**
 * Fades and rises its children into place the first time they scroll into
 * view, then stays revealed for good — never re-triggers on scroll back up.
 * Falls back to fully visible immediately if IntersectionObserver isn't
 * available or the visitor's system asks for reduced motion, so content is
 * never left invisible.
 */
export function Reveal({ children, delayMs = 0, className = '' }: RevealProps) {
  const [skipAnimation] = useState(shouldSkipReveal)
  const [revealed, setRevealed] = useState(skipAnimation)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (skipAnimation) return
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true)
            observer.disconnect()
          }
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out ${
        revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      } ${className}`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  )
}
