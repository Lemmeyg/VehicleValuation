const pushMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }))

jest.mock('@/lib/analytics/events', () => ({
  trackReportDownload: jest.fn(),
  trackReportWorkflow: jest.fn(),
  trackButtonClick: jest.fn(),
}))

import { render, screen, fireEvent } from '@testing-library/react'
import { PrintPdfButtons } from '@/app/reports/[id]/view/print-pdf-buttons'
import { trackReportWorkflow } from '@/lib/analytics/events'

describe('PrintPdfButtons', () => {
  beforeEach(() => {
    pushMock.mockClear()
    ;(trackReportWorkflow as jest.Mock).mockClear()
  })

  it('renders a Download PDF link to the download route when pdfDownloadToken is set and not expired', () => {
    render(
      <PrintPdfButtons
        reportId="report-abc"
        pdfDownloadToken="tok-1"
        pdfDownloadTokenExpiresAt="2099-01-01T00:00:00Z"
      />
    )
    const link = screen.getByRole('link', { name: /download pdf/i })
    expect(link).toHaveAttribute('href', '/api/reports/download/tok-1?source=page')
  })

  it('treats a missing expiry as never-expired (server always sets one, but be defensive)', () => {
    render(<PrintPdfButtons reportId="report-abc" pdfDownloadToken="tok-1" />)
    expect(screen.getByRole('link', { name: /download pdf/i })).toBeInTheDocument()
  })

  it('no longer tracks print_flow_started — the direct-download button downloads immediately', () => {
    render(<PrintPdfButtons reportId="report-abc" pdfDownloadToken="tok-1" />)
    fireEvent.click(screen.getByRole('link', { name: /download pdf/i }))
    expect(trackReportWorkflow).not.toHaveBeenCalledWith(
      expect.objectContaining({ step: 'print_flow_started' })
    )
  })

  it('falls back to a Save as PDF button (via /print) when pdfDownloadToken is null — e.g. a legacy report completed before that column existed', () => {
    render(<PrintPdfButtons reportId="report-abc" pdfDownloadToken={null} />)
    expect(screen.queryByRole('link', { name: /download pdf/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /save as pdf/i }))
    expect(pushMock).toHaveBeenCalledWith('/reports/report-abc/print')
    expect(trackReportWorkflow).toHaveBeenCalledWith({
      step: 'print_flow_started',
      reportId: 'report-abc',
    })
  })

  it('falls back to Save as PDF when pdfDownloadToken has expired — the download link never worked for it anyway', () => {
    render(
      <PrintPdfButtons
        reportId="report-abc"
        pdfDownloadToken="tok-1"
        pdfDownloadTokenExpiresAt="2020-01-01T00:00:00Z"
      />
    )
    expect(screen.queryByRole('link', { name: /download pdf/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save as pdf/i })).toBeInTheDocument()
  })

  it('carries the access token through to the /print fallback link when provided', () => {
    render(<PrintPdfButtons reportId="report-abc" token="tok-xyz" pdfDownloadToken={null} />)
    fireEvent.click(screen.getByRole('button', { name: /save as pdf/i }))
    expect(pushMock).toHaveBeenCalledWith('/reports/report-abc/print?token=tok-xyz')
  })

  it('renders Share button', () => {
    render(<PrintPdfButtons reportId="report-abc" pdfDownloadToken="tok-1" />)
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument()
  })
})
