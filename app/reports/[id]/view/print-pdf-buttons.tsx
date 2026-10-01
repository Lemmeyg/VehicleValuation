'use client'

import { useRouter } from 'next/navigation'
import { Download, Share2 } from 'lucide-react'
import { trackButtonClick, trackReportWorkflow } from '@/lib/analytics/events'

interface PrintPdfButtonsProps {
  reportId: string
  token?: string
  pdfDownloadToken: string | null
  pdfDownloadTokenExpiresAt?: string | null
}

/**
 * "Download PDF" links straight to the stored, QA-checked PDF (the same
 * file the ready email links to) when that link is still valid
 * (docs/Inbox/report-delivery-prd.md §9.6). It falls back to the /print
 * page — which never expires — when there's no download token at all
 * (a report completed before that column existed) or its 7-day window has
 * passed; a logged-in buyer's page access itself never expires, so their
 * ability to get a copy of the report must not expire either.
 */
export function PrintPdfButtons({
  reportId,
  token,
  pdfDownloadToken,
  pdfDownloadTokenExpiresAt,
}: PrintPdfButtonsProps) {
  const router = useRouter()

  const canDownloadDirectly =
    !!pdfDownloadToken &&
    (!pdfDownloadTokenExpiresAt || new Date(pdfDownloadTokenExpiresAt) > new Date())

  const handlePrintFallback = () => {
    trackReportWorkflow({ step: 'print_flow_started', reportId })
    const href = token ? `/reports/${reportId}/print?token=${token}` : `/reports/${reportId}/print`
    router.push(href)
  }

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

  return (
    <div className="flex items-center space-x-4">
      {canDownloadDirectly ? (
        <a
          href={`/api/reports/download/${pdfDownloadToken}?source=page`}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors print:hidden"
          title="Download PDF"
        >
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </a>
      ) : (
        <button
          onClick={handlePrintFallback}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors print:hidden"
          title="Save as PDF"
        >
          <Download className="h-4 w-4 mr-2" />
          Save as PDF
        </button>
      )}

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
