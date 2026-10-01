'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import {
  trackAuditPageViewed,
  trackAuditFormError,
  getPostHogDistinctId,
} from '@/lib/analytics/events'
import { readAttribution, type AuditAttribution } from '@/lib/audit-submissions/attribution'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024
const FILE_TOO_LARGE_MESSAGE =
  'That file is over the 3MB limit. Try the PDF version of the report, or retake the photo at a lower resolution (a screenshot also works).'

type FormState = 'idle' | 'submitting' | 'success' | 'error'

// Errors about the file are shown right under the file picker. On a phone the
// bottom of the form is a full screen away, so an error there goes unseen.
const FILE_ERROR_CODES = new Set([
  'missing_file',
  'file_type',
  'file_too_large',
  'server_rejected_413',
])

interface ValidationFailure {
  code: string
  message: string
}

interface CompsCheckFormProps {
  /** Copy-slot payload version, carried on every audit_* event as page_variant. */
  pageVariant?: string
  submitLabel?: string
}

export default function CompsCheckForm({
  pageVariant = 'default',
  submitLabel = 'Submit for review',
}: CompsCheckFormProps) {
  const [email, setEmail] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState<FormState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [errorIsAboutFile, setErrorIsAboutFile] = useState(false)
  const attributionRef = useRef<AuditAttribution>({
    source: 'direct',
    utmContent: null,
    pageVariant,
  })

  useEffect(() => {
    attributionRef.current = readAttribution(window.location.search, pageVariant)
    trackAuditPageViewed(attributionRef.current)
  }, [pageVariant])

  function fail(code: string, message: string) {
    setErrorMessage(message)
    setErrorIsAboutFile(FILE_ERROR_CODES.has(code))
    setState('error')
    trackAuditFormError(code, attributionRef.current)
  }

  function validate(): ValidationFailure | null {
    if (!EMAIL_REGEX.test(email.trim()))
      return { code: 'invalid_email', message: 'Please enter a valid email address.' }
    if (!file) return { code: 'missing_file', message: 'Please attach a file.' }
    if (!ALLOWED_FILE_TYPES.includes(file.type))
      return { code: 'file_type', message: 'Please upload a PDF, JPG, or PNG file.' }
    if (file.size > MAX_FILE_SIZE_BYTES)
      return { code: 'file_too_large', message: FILE_TOO_LARGE_MESSAGE }
    if (!consent)
      return { code: 'missing_consent', message: 'Please check the consent box to continue.' }
    return null
  }

  function handleFileChange(selected: File | null) {
    setFile(selected)
    // Tell people about an oversized photo the moment they pick it, not after
    // they've filled in everything else.
    if (selected && selected.size > MAX_FILE_SIZE_BYTES) {
      fail('file_too_large', FILE_TOO_LARGE_MESSAGE)
    } else if (state === 'error') {
      setErrorMessage('')
      setState('idle')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const validationFailure = validate()
    if (validationFailure) {
      fail(validationFailure.code, validationFailure.message)
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
    formData.append('source', attributionRef.current.source)
    if (attributionRef.current.utmContent) {
      formData.append('utm_content', attributionRef.current.utmContent)
    }
    formData.append('page_variant', attributionRef.current.pageVariant)
    const distinctId = getPostHogDistinctId()
    if (distinctId) formData.append('ph_distinct_id', distinctId)

    try {
      const res = await fetch('/api/audit-submissions', { method: 'POST', body: formData })

      if (!res.ok) {
        let message =
          res.status === 413 ? FILE_TOO_LARGE_MESSAGE : 'Something went wrong. Please try again.'
        try {
          const data = await res.json()
          if (data?.error) message = data.error
        } catch {
          // Non-JSON error body (e.g. a platform-level 413 from an oversized
          // upload) — keep the fallback message rather than crashing.
        }
        fail(`server_rejected_${res.status}`, message)
        return
      }

      setState('success')
    } catch {
      fail('network_error', 'Something went wrong. Please try again.')
    }
  }

  if (state === 'success') {
    return (
      <div
        id="comps-check-success"
        className="flex flex-col items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-6 text-center"
      >
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
          Your insurer&apos;s report (CCC One, Mitchell or Audatex) or their comps list
        </label>
        <p id="audit-file-hint" className="text-sm text-slate-500 mb-2">
          Usually a PDF your adjuster emailed you. PDF, JPG or PNG, up to 3MB. A clear phone photo
          is fine too.
        </p>
        <input
          id="audit-file"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          aria-describedby="audit-file-hint"
          onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
          disabled={state === 'submitting'}
          className="w-full text-sm"
        />
        {errorMessage && errorIsAboutFile && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        )}
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
          I agree to Total Loss Toolkit reviewing this document. It&apos;s free with no obligation.
          We delete it within 90 days, or sooner if you email support@totallosstoolkit.com.
        </span>
      </label>

      {errorMessage && !errorIsAboutFile && (
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
          submitLabel
        )}
      </button>
    </form>
  )
}
