import Link from 'next/link'
import { FileDown } from 'lucide-react'

export function DisputeLetterCTA() {
  return (
    <div className="mt-8 rounded-2xl border-2 border-primary-200 bg-white px-8 py-8">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 rounded-xl bg-primary-50 p-3">
          <FileDown className="h-6 w-6 text-primary-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Get the Free Dispute Letter Template</h2>
          <p className="mt-2 text-slate-600">
            A professionally written 3-part letter that disputes the valuation, challenges the
            methodology, and demands the comps your insurer used. Download free — no account needed.
          </p>
          <Link
            href="/dispute-letter"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
          >
            Download Free Letter →
          </Link>
        </div>
      </div>
    </div>
  )
}
