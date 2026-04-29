'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Props {
  reportId: string
  token: string
}

export function TokenAccessBanner({ reportId, token: _token }: Props) {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)

  // Appear after 1 second so report content draws first
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1000)
    return () => clearTimeout(t)
  }, [])

  if (!visible || dismissed) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available — silently ignore
    }
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 flex justify-center pb-4 px-4 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-2xl bg-amber-50 border border-amber-300 rounded-xl shadow-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
        role="alert"
      >
        {/* Message */}
        <div className="flex-1 text-sm text-amber-900">
          <span className="font-semibold">This link expires in 24 hours.</span> After that,{' '}
          <Link
            href={`/auth?redirect=/reports/${reportId}/view`}
            className="underline font-medium hover:text-amber-700"
          >
            sign in or create an account
          </Link>{' '}
          to access your report anytime.{' '}
          <span className="text-amber-700">Tip: export to PDF using the button above.</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="text-amber-700 hover:text-amber-900 text-xl leading-none font-bold px-1"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
