'use client'

import { Download } from 'lucide-react'
import { trackReportDownload } from '@/lib/analytics/events'

interface PrintChecklistButtonProps {
  reportId: string
}

// window.print() only exists in the browser — this must be a Client Component.
// Previously inlined as a plain onClick in the (server) action-plan page, which
// crashed the entire page for every visitor: a Server Component cannot serialize
// a DOM event handler.
export function PrintChecklistButton({ reportId }: PrintChecklistButtonProps) {
  const handlePrint = () => {
    trackReportDownload('pdf', reportId, 'print')
    window.print()
  }

  return (
    <button
      onClick={handlePrint}
      className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
    >
      <Download className="h-4 w-4 mr-2" />
      Print Checklist
    </button>
  )
}
