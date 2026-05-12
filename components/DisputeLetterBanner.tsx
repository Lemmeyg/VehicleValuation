import Link from 'next/link'
import { FileDown } from 'lucide-react'

export default function DisputeLetterBanner() {
  return (
    <section className="bg-slate-100 border-y border-slate-200 py-5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileDown className="h-5 w-5 text-slate-500 flex-shrink-0" />
            <p className="text-sm md:text-base text-slate-700">
              <strong className="text-slate-900">Already received an offer?</strong> Download our
              free dispute letter template — then back it up with an independent valuation report.
            </p>
          </div>
          <Link
            href="/dispute-letter"
            className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-slate-400 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <FileDown className="h-4 w-4" />
            Get Free Letter
          </Link>
        </div>
      </div>
    </section>
  )
}
