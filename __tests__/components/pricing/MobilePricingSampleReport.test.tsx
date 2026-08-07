import { render, screen, fireEvent } from '@testing-library/react'
import MobilePricingSampleReport from '@/components/pricing/MobilePricingSampleReport'

describe('MobilePricingSampleReport', () => {
  it('shows the report teaser but hides full detail by default', () => {
    render(<MobilePricingSampleReport />)
    expect(screen.getByText('2021 BMW X3')).toBeInTheDocument()
    expect(screen.getByText('$22,654')).toBeInTheDocument()
    expect(screen.queryByText('Vehicle Specifications')).not.toBeInTheDocument()
  })

  it('reveals the full report when the toggle is clicked', () => {
    render(<MobilePricingSampleReport />)
    fireEvent.click(screen.getByRole('button', { name: /tap to see full report/i }))
    expect(screen.getByText('Vehicle Specifications')).toBeInTheDocument()
    expect(screen.getByText('Market Comparables')).toBeInTheDocument()
    expect(screen.getByText('+ 4 more comparable vehicles in full report')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /collapse report/i })).toBeInTheDocument()
  })

  it("labels which price bucket and chart point is the visitor's own vehicle", () => {
    render(<MobilePricingSampleReport />)
    fireEvent.click(screen.getByRole('button', { name: /tap to see full report/i }))
    expect(screen.getAllByText('YOUR VEHICLE').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Your Vehicle')).toBeInTheDocument()
  })

  it('calls onExpand when the toggle transitions from collapsed to expanded', () => {
    const onExpand = jest.fn()
    render(<MobilePricingSampleReport onExpand={onExpand} />)
    expect(onExpand).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /tap to see full report/i }))
    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it('does not call onExpand when the toggle collapses the report again', () => {
    const onExpand = jest.fn()
    render(<MobilePricingSampleReport onExpand={onExpand} />)
    fireEvent.click(screen.getByRole('button', { name: /tap to see full report/i }))
    expect(onExpand).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /collapse report/i }))
    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it('does not call onExpand on initial render', () => {
    const onExpand = jest.fn()
    render(<MobilePricingSampleReport onExpand={onExpand} />)
    expect(onExpand).not.toHaveBeenCalled()
  })
})
