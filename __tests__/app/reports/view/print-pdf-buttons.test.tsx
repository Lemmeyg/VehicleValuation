const pushMock = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

jest.mock('@/lib/analytics/events', () => ({
  trackReportDownload: jest.fn(),
  trackReportWorkflow: jest.fn(),
  trackButtonClick: jest.fn(),
}))

import { render, screen, fireEvent } from '@testing-library/react'
import { PrintPdfButtons } from '@/app/reports/[id]/view/print-pdf-buttons'
import { trackReportDownload, trackReportWorkflow } from '@/lib/analytics/events'

describe('PrintPdfButtons', () => {
  beforeEach(() => {
    pushMock.mockClear()
    ;(trackReportDownload as jest.Mock).mockClear()
    ;(trackReportWorkflow as jest.Mock).mockClear()
  })

  it('navigates to /print when Save as PDF is clicked (no token)', () => {
    render(<PrintPdfButtons reportId="report-abc" />)
    fireEvent.click(screen.getByRole('button', { name: /save as pdf/i }))
    expect(pushMock).toHaveBeenCalledWith('/reports/report-abc/print')
  })

  // BL-125: this button only navigates to the print page. Firing report_downloaded
  // here counted a click as a delivered PDF — the real download event now lives on
  // the print action itself, in PrintToolbar.
  it('does not track report_downloaded — clicking this button only navigates', () => {
    render(<PrintPdfButtons reportId="report-abc" />)
    fireEvent.click(screen.getByRole('button', { name: /save as pdf/i }))
    expect(trackReportDownload).not.toHaveBeenCalled()
  })

  it('tracks print_flow_started when Save as PDF is clicked', () => {
    render(<PrintPdfButtons reportId="report-abc" />)
    fireEvent.click(screen.getByRole('button', { name: /save as pdf/i }))
    expect(trackReportWorkflow).toHaveBeenCalledWith({
      step: 'print_flow_started',
      reportId: 'report-abc',
    })
  })

  it('navigates to /print with token when token is provided', () => {
    render(<PrintPdfButtons reportId="report-abc" token="tok-xyz" />)
    fireEvent.click(screen.getByRole('button', { name: /save as pdf/i }))
    expect(pushMock).toHaveBeenCalledWith('/reports/report-abc/print?token=tok-xyz')
  })

  it('does not make a fetch call to generate-pdf', () => {
    const fetchSpy = jest.spyOn(global, 'fetch')
    render(<PrintPdfButtons reportId="report-abc" />)
    fireEvent.click(screen.getByRole('button', { name: /save as pdf/i }))
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('renders Share button', () => {
    render(<PrintPdfButtons reportId="report-abc" />)
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument()
  })
})
