'use client'

import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { trackReportDownload } from '@/lib/analytics/events'

interface PrintToolbarProps {
  backHref: string
  vehicleLabel: string
  reportId: string
}

export function PrintToolbar({ backHref, vehicleLabel, reportId }: PrintToolbarProps) {
  // BL-125: the closest thing to a download the in-app path can observe. The
  // browser will not tell us whether the user then clicked Save or Cancel.
  const handlePrint = () => {
    trackReportDownload('pdf', reportId, 'print')
    window.print()
  }

  return (
    <div className="print:hidden sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <Link
          href={backHref}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Report
        </Link>

        <span className="text-sm font-medium text-slate-700 truncate hidden sm:block">
          {vehicleLabel}
        </span>

        <div className="flex items-center gap-3 shrink-0">
          <p className="text-xs text-slate-500 hidden md:block">
            In the print dialog, uncheck &ldquo;Headers and footers&rdquo; for a clean document.
          </p>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </button>
        </div>
      </div>
    </div>
  )
}
