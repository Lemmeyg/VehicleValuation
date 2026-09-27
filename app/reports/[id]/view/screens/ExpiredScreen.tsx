import { SUPPORT_EMAIL } from '@/lib/constants'

export function ExpiredScreen() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-3">This report link has expired</h1>
        <p className="text-slate-600">
          Report links stay active for 7 days after your report is ready. Email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-emerald-600 underline">
            {SUPPORT_EMAIL}
          </a>{' '}
          from the address you used at checkout and we&apos;ll help.
        </p>
      </div>
    </div>
  )
}
