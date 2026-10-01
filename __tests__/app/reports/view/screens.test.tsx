import { render, screen } from '@testing-library/react'
import { RefundedScreen } from '@/app/reports/[id]/view/screens/RefundedScreen'
import { ExpiredScreen } from '@/app/reports/[id]/view/screens/ExpiredScreen'

describe('RefundedScreen', () => {
  it('shows the refunded message and support email', () => {
    render(<RefundedScreen />)
    expect(screen.getByText(/this order was refunded/i)).toBeInTheDocument()
    expect(screen.getByText(/support@totallosstoolkit\.com/)).toBeInTheDocument()
  })
})

describe('ExpiredScreen', () => {
  it('shows the expired message with the 7-day explanation and support email', () => {
    render(<ExpiredScreen />)
    expect(screen.getByText(/this report link has expired/i)).toBeInTheDocument()
    expect(screen.getByText(/7 days/)).toBeInTheDocument()
    expect(screen.getByText(/support@totallosstoolkit\.com/)).toBeInTheDocument()
  })
})
