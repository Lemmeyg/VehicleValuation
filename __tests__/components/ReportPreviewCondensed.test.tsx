import { render, screen } from '@testing-library/react'
import ReportPreviewCondensed from '@/components/ReportPreviewCondensed'

describe('ReportPreviewCondensed', () => {
  it('renders without crashing', () => {
    render(<ReportPreviewCondensed />)
  })

  it('shows all three value range labels', () => {
    render(<ReportPreviewCondensed />)
    expect(screen.getByText('LOW RANGE')).toBeInTheDocument()
    expect(screen.getByText('MARKET VALUE')).toBeInTheDocument()
    expect(screen.getByText('HIGH RANGE')).toBeInTheDocument()
  })

  it('shows all three dollar amounts', () => {
    render(<ReportPreviewCondensed />)
    // Each amount appears in both the value card and the value summary — use getAllByText
    expect(screen.getAllByText('$20,389').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('$22,654').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('$24,919').length).toBeGreaterThanOrEqual(1)
  })

  it('shows vehicle spec fields', () => {
    render(<ReportPreviewCondensed />)
    expect(screen.getByText('Vehicle Specifications')).toBeInTheDocument()
    expect(screen.getByText('2021')).toBeInTheDocument()
    expect(screen.getByText('BMW')).toBeInTheDocument()
    expect(screen.getByText('67,027 mi')).toBeInTheDocument()
  })

  it('renders the desktop comparables table', () => {
    render(<ReportPreviewCondensed />)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('renders the mobile comparables card list', () => {
    render(<ReportPreviewCondensed />)
    // The mobile card list is always in the DOM — CSS controls visibility
    expect(screen.getByTestId('comparables-mobile')).toBeInTheDocument()
  })

  it('shows comparable vehicle prices in the mobile card list', () => {
    render(<ReportPreviewCondensed />)
    const mobile = screen.getByTestId('comparables-mobile')
    expect(mobile).toHaveTextContent('$23,077')
    expect(mobile).toHaveTextContent('$22,963')
    expect(mobile).toHaveTextContent('$23,502')
  })
})
