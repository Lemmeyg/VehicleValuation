jest.mock('@/lib/analytics/events', () => ({
  trackReportDownload: jest.fn(),
}))

import { render, screen, fireEvent } from '@testing-library/react'
import { PrintToolbar } from '@/app/reports/[id]/print/PrintToolbar'
import { trackReportDownload } from '@/lib/analytics/events'

describe('PrintToolbar', () => {
  const props = {
    backHref: '/reports/abc123/view',
    vehicleLabel: '2020 Honda Civic',
    reportId: 'abc123',
  }

  beforeEach(() => {
    ;(trackReportDownload as jest.Mock).mockClear()
  })

  it('renders back link with correct href', () => {
    render(<PrintToolbar {...props} />)
    const backLink = screen.getByRole('link', { name: /back to report/i })
    expect(backLink).toHaveAttribute('href', '/reports/abc123/view')
  })

  it('renders vehicle label on medium+ screens', () => {
    render(<PrintToolbar {...props} />)
    expect(screen.getByText('2020 Honda Civic')).toBeInTheDocument()
  })

  it('calls window.print() when button is clicked', () => {
    const printMock = jest.fn()
    Object.defineProperty(window, 'print', { value: printMock, writable: true })
    render(<PrintToolbar {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /print/i }))
    expect(printMock).toHaveBeenCalledTimes(1)
  })

  it('has print:hidden class so toolbar disappears from printed output', () => {
    const { container } = render(<PrintToolbar {...props} />)
    const toolbar = container.firstChild as HTMLElement
    expect(toolbar.className).toContain('print:hidden')
  })

  /**
   * BL-125: this is the real download moment. The "Save as PDF" button on /view
   * only navigates here; the browser print dialog opens from this toolbar.
   */
  describe('download tracking (BL-125)', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'print', { value: jest.fn(), writable: true })
    })

    it('tracks report_downloaded with the print source when the print button is clicked', () => {
      render(<PrintToolbar {...props} />)
      fireEvent.click(screen.getByRole('button', { name: /print/i }))
      expect(trackReportDownload).toHaveBeenCalledWith('pdf', 'abc123', 'print')
    })

    it('does not track anything before the print button is clicked', () => {
      render(<PrintToolbar {...props} />)
      expect(trackReportDownload).not.toHaveBeenCalled()
    })
  })
})
