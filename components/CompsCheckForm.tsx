'use client'

import { useState, useEffect } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { trackAuditPageViewed, trackAuditFormError } from '@/lib/analytics/events'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024

type FormState = 'idle' | 'submitting' | 'success' | 'error'

export default function CompsCheckForm() {
  const [email, setEmail] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState<FormState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    trackAuditPageViewed()
  }, [])

  function validate(): string | null {
    if (!EMAIL_REGEX.test(email.trim())) return 'Please enter a valid email address.'
    if (!file) return 'Please attach a file.'
    if (!ALLOWED_FILE_TYPES.includes(file.type)) return 'Please upload a PDF, JPG, or PNG file.'
    if (file.size > MAX_FILE_SIZE_BYTES) return 'File must be 4MB or smaller.'
    if (!consent) return 'Please check the consent box to continue.'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const validationError = validate()
    if (validationError) {
      setErrorMessage(validationError)
      setState('error')
      trackAuditFormError('client_validation')
      return
    }

    setState('submitting')
    setErrorMessage('')

    const formData = new FormData()
    formData.append('email', email)
    formData.append('file', file as File)
    if (note.trim()) formData.append('note', note.trim())
    formData.append('consentAck', String(consent))
    formData.append('company_website', honeypot)

    try {
      const res = await fetch('/api/audit-submissions', { method: 'POST', body: formData })

      if (!res.ok) {
        let message = 'Something went wrong. Please try again.'
        try {
          const data = await res.json()
          if (data?.error) message = data.error
        } catch {
          // Non-JSON error body (e.g. a platform-level 413 from an oversized
          // upload) — fall back to the generic message rather than crashing.
        }
        setErrorMessage(message)
        setState('error')
        trackAuditFormError(`server_rejected_${res.status}`)
        return
      }

      setState('success')
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
      setState('error')
      trackAuditFormError('network_error')
    }
  }

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
        <p className="font-semibold text-green-800">
          Thanks — we&apos;ll review this and get back to you within 48 hours.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div>
        <label htmlFor="audit-email" className="block text-sm font-medium text-slate-700 mb-1">
          Email address
        </label>
        <input
          id="audit-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={state === 'submitting'}
          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
        />
      </div>

      <div>
        <label htmlFor="audit-file" className="block text-sm font-medium text-slate-700 mb-1">
          Your insurer&apos;s report or comps list (PDF, JPG, or PNG)
        </label>
        <input
          id="audit-file"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          disabled={state === 'submitting'}
          className="w-full text-sm"
        />
      </div>

      <div>
        <label htmlFor="audit-note" className="block text-sm font-medium text-slate-700 mb-1">
          Anything else you want us to know? (optional)
        </label>
        <textarea
          id="audit-note"
          value={note}
          onChange={e => setNote(e.target.value)}
          disabled={state === 'submitting'}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
        />
      </div>

      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <label htmlFor="company_website">Company website</label>
        <input
          id="company_website"
          name="company_website"
          type="text"
          value={honeypot}
          onChange={e => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={consent}
          onChange={e => setConsent(e.target.checked)}
          disabled={state === 'submitting'}
          className="mt-1"
        />
        <span>
          We&apos;ll review the document you upload for pricing adjustments that courts have already
          ruled against in similar cases — we may or may not find something. Your file is kept for
          90 days and then automatically deleted. This is free and optional; there&apos;s no
          obligation and no purchase required.
        </span>
      </label>

      {errorMessage && (
        <p className="text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'submitting'}
        className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
      >
        {state === 'submitting' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          'Submit for review'
        )}
      </button>
    </form>
  )
}
