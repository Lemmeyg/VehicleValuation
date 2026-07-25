import Link from 'next/link'

interface MarketingConsentNoticeProps {
  variant?: 'light' | 'dark'
  className?: string
}

export function MarketingConsentNotice({
  variant = 'light',
  className = '',
}: MarketingConsentNoticeProps) {
  const colorClass = variant === 'dark' ? 'text-white/55' : 'text-slate-500'

  return (
    <p className={`text-xs ${colorClass} ${className}`}>
      We&apos;ll send you related resources and occasional offers by email; you may unsubscribe at
      any time.{' '}
      <Link href="/privacy" className="underline hover:opacity-80">
        Privacy Policy
      </Link>
      .
    </p>
  )
}
