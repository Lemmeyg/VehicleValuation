'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SUPPORT_EMAIL } from '@/lib/constants'

interface Props {
  reportId: string
  vehicleLabel: string
  paidAt: string | null
  initialState: 'held' | 'progress'
}

const HOLD_CUTOFF_MS = 120_000
const FAST_POLL_MS = 2_000
const SLOW_POLL_MS = 15_000
const POLL_STOP_MS = 15 * 60 * 1000

const STEPS: { key: 'comps' | 'listings' | 'valuation' | 'pdf'; label: string }[] = [
  { key: 'comps', label: 'Finding comparable vehicles' },
  { key: 'listings', label: 'Checking listings are live' },
  { key: 'valuation', label: 'Calculating vehicle valuation' },
  { key: 'pdf', label: 'Building your report' },
]

function reassuranceLine(elapsedMs: number): string {
  if (elapsedMs < 30_000) return 'This usually takes under a minute.'
  if (elapsedMs < 60_000) return 'Still working — some vehicles take a little longer.'
  return "Almost there — we're making sure every comparable holds up."
}

/**
 * Renders both the progress screen and the held screen, and owns the
 * polling that decides when to switch between them (or hand off to the
 * server-rendered ready/refunded content via router.refresh()).
 *
 * A report still "working" past 120 seconds shows the identical held
 * message as a genuinely held report — that's a display rule, not a status
 * change (docs/Inbox/report-delivery-prd.md §8.1/§9.2), so this component
 * decides that switch from a client-side clock, never from the server.
 */
export function ProgressHeldGate({ reportId, vehicleLabel, paidAt, initialState }: Props) {
  const router = useRouter()
  const startedAt = useRef(paidAt ? new Date(paidAt).getTime() : Date.now())
  const [elapsedMs, setElapsedMs] = useState(() => Date.now() - startedAt.current)
  const [step, setStep] = useState<'comps' | 'listings' | 'valuation' | 'pdf' | null>(null)
  const [heldByTimeout, setHeldByTimeout] = useState(elapsedMs >= HOLD_CUTOFF_MS)

  const showHeld = initialState === 'held' || heldByTimeout

  useEffect(() => {
    if (showHeld) return
    const tick = setInterval(() => setElapsedMs(Date.now() - startedAt.current), 1000)
    return () => clearInterval(tick)
  }, [showHeld])

  useEffect(() => {
    if (elapsedMs >= HOLD_CUTOFF_MS) setHeldByTimeout(true)
  }, [elapsedMs])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      if (cancelled) return
      if (Date.now() - startedAt.current >= POLL_STOP_MS) return

      try {
        const res = await fetch(`/api/reports/${reportId}/status`)
        if (res.ok) {
          const data = await res.json()
          if (data.state && data.state !== 'working' && data.state !== 'awaiting_payment') {
            router.refresh()
            return
          }
          if (typeof data.step === 'string') setStep(data.step)
        }
      } catch {
        // network error — keep polling
      }

      if (cancelled) return
      const interval = Date.now() - startedAt.current < HOLD_CUTOFF_MS ? FAST_POLL_MS : SLOW_POLL_MS
      timer = setTimeout(poll, interval)
    }

    poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId])

  if (showHeld) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center motion-safe:animate-pulse motion-reduce:animate-none">
            <div className="h-8 w-8 rounded-full bg-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            We&apos;re double-checking your data
          </h1>
          <p className="text-slate-600 mb-4">
            Your {vehicleLabel} report needs a closer look to make sure every comparable vehicle
            holds up against the insurer. You don&apos;t need to do anything — we&apos;ll email you
            at the address you used at checkout within 2 business days.
          </p>
          <p className="text-sm text-slate-500">
            Questions?{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-emerald-600 underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    )
  }

  const activeIndex = STEPS.findIndex(s => s.key === step)

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <p className="text-emerald-600 font-semibold mb-1">✓ Payment confirmed</p>
        <h1 className="text-xl font-bold text-slate-900 mb-6">
          Building your report for {vehicleLabel}
        </h1>
        <ul className="text-left space-y-3 mb-6">
          {STEPS.map((s, i) => {
            const done = activeIndex > i
            const active = activeIndex === i
            return (
              <li key={s.key} className="flex items-center gap-3">
                <span
                  className={
                    done
                      ? 'h-5 w-5 rounded-full bg-emerald-500 flex-shrink-0'
                      : active
                        ? 'h-5 w-5 rounded-full border-2 border-emerald-500 motion-safe:animate-spin motion-reduce:animate-none flex-shrink-0'
                        : 'h-5 w-5 rounded-full border-2 border-slate-300 flex-shrink-0'
                  }
                />
                <span className={done || active ? 'text-slate-900' : 'text-slate-400'}>
                  {s.label}
                </span>
              </li>
            )
          })}
        </ul>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-4">
          <div className="h-full w-full bg-emerald-500 rounded-full motion-safe:animate-pulse motion-reduce:animate-none" />
        </div>
        <p className="text-sm text-slate-500">{reassuranceLine(elapsedMs)}</p>
      </div>
    </div>
  )
}
