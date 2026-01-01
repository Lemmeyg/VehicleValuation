'use client'

import { useState } from 'react'
import { FileText, Download, Loader2, Share2 } from 'lucide-react'

interface PrintPdfButtonsProps {
  reportId: string
}

export function PrintPdfButtons({ reportId }: PrintPdfButtonsProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const handlePrint = () => {
    // Use browser's native print functionality
    window.print()
  }

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true)
      setPdfError(null)

      // Call the PDF generation API
      const response = await fetch(`/api/reports/${reportId}/generate-pdf`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        // Show user-friendly error messages
        if (response.status === 400 && data.error?.includes('not been paid')) {
          setPdfError(
            'PDF download is only available for paid reports. Please complete payment to download.'
          )
        } else {
          throw new Error(data.error || 'Failed to generate PDF')
        }
        return
      }

      if (data.pdfUrl) {
        // Open PDF in new tab for viewing/downloading
        window.open(data.pdfUrl, '_blank')
      }
    } catch (error) {
      console.error('Error generating PDF:', error)
      setPdfError(error instanceof Error ? error.message : 'Failed to generate PDF')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const handleShare = async () => {
    const url = window.location.href

    // Use Web Share API if available
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Vehicle Valuation Report',
          text: 'Check out this vehicle valuation report',
          url: url,
        })
      } catch (err) {
        // User cancelled or share failed, fallback to clipboard
        if (err instanceof Error && err.name !== 'AbortError') {
          await copyToClipboard(url)
        }
      }
    } else {
      // Fallback to clipboard copy
      await copyToClipboard(url)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Link copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="flex items-center space-x-4">
      {pdfError && (
        <div className="mr-4 max-w-xs">
          <p className="text-sm text-red-600">{pdfError}</p>
        </div>
      )}

      <button
        onClick={handlePrint}
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors print:hidden"
        title="Print this report"
      >
        <FileText className="h-4 w-4 mr-2" />
        Print
      </button>

      <button
        onClick={handleDownloadPdf}
        disabled={isGeneratingPdf}
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed print:hidden"
        title="Download as PDF"
      >
        {isGeneratingPdf ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </>
        )}
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
