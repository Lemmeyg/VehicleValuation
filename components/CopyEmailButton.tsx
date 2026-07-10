'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CopyEmailButtonProps {
  email: string
}

export function CopyEmailButton({ email }: CopyEmailButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — silently no-op,
      // the email is still visible as selectable text for manual copy.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
      aria-label={copied ? 'Email copied' : 'Copy email address'}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" />
          Copy email
        </>
      )}
    </button>
  )
}
