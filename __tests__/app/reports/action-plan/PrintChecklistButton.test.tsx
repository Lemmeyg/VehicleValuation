jest.mock('@/lib/analytics/events', () => ({
  trackReportDownload: jest.fn(),
}))

import { render, screen, fireEvent } from '@testing-library/react'
import { PrintChecklistButton } from '@/app/reports/[id]/action-plan/PrintChecklistButton'
import { trackReportDownload } from '@/lib/analytics/events'

describe('PrintChecklistButton', () => {
  beforeEach(() => {
    ;(trackReportDownload as jest.Mock).mockClear()
    Object.defineProperty(window, 'print', { value: jest.fn(), writable: true })
  })

  it('renders a Print Checklist button', () => {
    render(<PrintChecklistButton reportId="abc123" />)
    expect(screen.getByRole('button', { name: /print checklist/i })).toBeInTheDocument()
  })

  it('calls window.print() when clicked', () => {
    render(<PrintChecklistButton reportId="abc123" />)
    fireEvent.click(screen.getByRole('button', { name: /print checklist/i }))
    expect(window.print).toHaveBeenCalledTimes(1)
  })

  it('tracks report_downloaded with the print source when clicked', () => {
    render(<PrintChecklistButton reportId="abc123" />)
    fireEvent.click(screen.getByRole('button', { name: /print checklist/i }))
    expect(trackReportDownload).toHaveBeenCalledWith('pdf', 'abc123', 'print')
  })
})
