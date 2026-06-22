'use client'

import { useRouter } from 'next/navigation'
import { Download, Share2 } from 'lucide-react'
import { trackReportWorkflow, trackButtonClick } from '@/lib/analytics/events'

interface PrintPdfButtonsProps {
  reportId: string
  token?: string
}

export function PrintPdfButtons({ reportId, token }: PrintPdfButtonsProps) {
  const router = useRouter()

  const handleSaveAsPdf = () => {
    trackReportWorkflow({ step: 'print_dialog_opened', reportId })
    const href = token ? `/reports/${reportId}/print?token=${token}` : `/reports/${reportId}/print`
    router.push(href)
  }

  const handleShare = async () => {
    const url = window.location.href
    trackButtonClick('share_report', { reportId })
    trackReportWorkflow({ step: 'report_shared', reportId })

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
      <button
        onClick={handleSaveAsPdf}
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors print:hidden"
        title="Save as PDF"
      >
        <Download className="h-4 w-4 mr-2" />
        Save as PDF
      </button>

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
