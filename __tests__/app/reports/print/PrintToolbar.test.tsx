import { render, screen, fireEvent } from '@testing-library/react'
import { PrintToolbar } from '@/app/reports/[id]/print/PrintToolbar'

describe('PrintToolbar', () => {
  const props = {
    backHref: '/reports/abc123/view',
    vehicleLabel: '2020 Honda Civic',
    reportId: 'abc123',
  }

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
})
