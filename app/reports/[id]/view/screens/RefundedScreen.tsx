import { SUPPORT_EMAIL } from '@/lib/constants'

export function RefundedScreen() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-3">This order was refunded</h1>
        <p className="text-slate-600">
          Questions?{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-emerald-600 underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  )
}
