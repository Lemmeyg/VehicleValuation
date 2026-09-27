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

  it('renders nothing when pdfDownloadToken is null (unreleased report — PRD §9.5)', () => {
    const { container } = render(<PrintPdfButtons reportId="report-abc" pdfDownloadToken={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a Download PDF link to the download route when pdfDownloadToken is set', () => {
    render(<PrintPdfButtons reportId="report-abc" pdfDownloadToken="tok-1" />)
    const link = screen.getByRole('link', { name: /download pdf/i })
    expect(link).toHaveAttribute('href', '/api/reports/download/tok-1?source=page')
  })

  it('no longer tracks print_flow_started — the button downloads directly now', () => {
    render(<PrintPdfButtons reportId="report-abc" pdfDownloadToken="tok-1" />)
    fireEvent.click(screen.getByRole('link', { name: /download pdf/i }))
    expect(trackReportWorkflow).not.toHaveBeenCalledWith(
      expect.objectContaining({ step: 'print_flow_started' })
    )
  })

  it('renders Share button', () => {
    render(<PrintPdfButtons reportId="report-abc" pdfDownloadToken="tok-1" />)
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument()
  })
})
