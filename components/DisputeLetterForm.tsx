'use client'

import { useState } from 'react'
import { FileDown, Loader2, CheckCircle2 } from 'lucide-react'
import { trackEvent } from '@/lib/analytics/events'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FormState = 'idle' | 'loading' | 'success' | 'error'

export default function DisputeLetterForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<FormState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!EMAIL_REGEX.test(email)) {
      setErrorMessage('Please enter a valid email address.')
      setState('error')
      return
    }

    setState('loading')
    setErrorMessage('')

    try {
      const res = await fetch('/api/dispute-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error || 'Something went wrong. Please try again.')
        setState('error')
        return
      }

      const a = document.createElement('a')
      a.href = data.downloadUrl
      a.download = 'TotalLoss-DisputeLetter.docx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      trackEvent('dispute_letter_downloaded')
      setState('success')
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
        <p className="font-semibold text-green-800">Your download has started!</p>
        <p className="text-sm text-green-700">
          Check your downloads folder for <strong>TotalLoss-DisputeLetter.docx</strong>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          inputMode="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Your email address"
          disabled={state === 'loading'}
          className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
          aria-label="Email address"
        />
        <button
          type="submit"
          disabled={state === 'loading'}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {state === 'loading' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4" />
              Download Free Letter
            </>
          )}
        </button>
      </div>
      {errorMessage && (
        <p className="text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      )}
      <p className="text-xs text-slate-500 text-center">
        No spam. We&apos;ll only use your email to send you relevant resources.
      </p>
    </form>
  )
}
