'use client'

import { Download, Share2 } from 'lucide-react'
import { trackButtonClick } from '@/lib/analytics/events'

interface PrintPdfButtonsProps {
  reportId: string
  token?: string
  pdfDownloadToken: string | null
}

/**
 * Hidden until the report is released — "Download PDF" links straight to
 * the stored, QA-checked PDF (the same file the ready email links to),
 * never a fresh /print re-render (docs/Inbox/report-delivery-prd.md §9.6).
 */
export function PrintPdfButtons({ reportId, pdfDownloadToken }: PrintPdfButtonsProps) {
  const handleShare = async () => {
    const url = window.location.href
    trackButtonClick('share_report', { reportId })

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'TotalLossToolKit Report',
          text: 'Check out this report from TotalLossToolKit',
          url,
        })
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          await copyToClipboard(url)
        }
      }
    } else {
      await copyToClipboard(url)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Link copied to clipboard!')
    } catch {
      console.error('Failed to copy link')
    }
  }

  if (!pdfDownloadToken) return null

  return (
    <div className="flex items-center space-x-4">
      <a
        href={`/api/reports/download/${pdfDownloadToken}?source=page`}
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors print:hidden"
        title="Download PDF"
      >
        <Download className="h-4 w-4 mr-2" />
        Download PDF
      </a>

      <button
        onClick={handleShare}
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors print:hidden"
        title="Share this report"
      >
        <Share2 className="h-4 w-4 mr-2" />
        Share
      </button>
    </div>
  )
}
