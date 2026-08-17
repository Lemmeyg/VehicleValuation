import { render } from '@testing-library/react'
import { CheckoutReturnTracker } from '@/components/CheckoutReturnTracker'
import { trackCheckoutAbandoned } from '@/lib/analytics/events'
import { markCheckoutHandoff, readCheckoutHandoff } from '@/lib/analytics/checkout-return'

jest.mock('@/lib/analytics/events', () => ({
  trackCheckoutAbandoned: jest.fn(),
}))

function setSearch(search: string) {
  // jsdom 30's window.location is a non-configurable accessor, so it can't be
  // replaced via Object.defineProperty (throws "Cannot redefine property")
  // and `delete` on it is a silent no-op. history.pushState drives jsdom's
  // real navigation machinery instead, which updates window.location.search
  // without touching the property descriptor at all.
  window.history.pushState({}, '', `${window.location.pathname}${search}`)
}

describe('CheckoutReturnTracker', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
    setSearch('')
  })

  it('does nothing when there is no handoff marker', () => {
    render(<CheckoutReturnTracker />)
    expect(trackCheckoutAbandoned).not.toHaveBeenCalled()
  })

  it('reports abandonment when the visitor returns without buying', () => {
    markCheckoutHandoff({ reportId: 'rpt-9', plan: 'premium', price: 25 })

    render(<CheckoutReturnTracker />)

    expect(trackCheckoutAbandoned).toHaveBeenCalledTimes(1)
    expect(trackCheckoutAbandoned).toHaveBeenCalledWith({
      reportId: 'rpt-9',
      plan: 'premium',
      price: 25,
      step: 'returned_without_purchase',
    })
    expect(readCheckoutHandoff()).toBeNull()
  })

  it('clears the marker without reporting when the purchase completed', () => {
    markCheckoutHandoff({ reportId: 'rpt-9', plan: 'premium', price: 25 })
    setSearch('?token=abc&checkout=complete')

    render(<CheckoutReturnTracker />)

    expect(trackCheckoutAbandoned).not.toHaveBeenCalled()
    expect(readCheckoutHandoff()).toBeNull()
  })

  it('reports abandonment when the query string contains an unrelated param that merely contains "checkout=complete"', () => {
    markCheckoutHandoff({ reportId: 'rpt-9', plan: 'premium', price: 25 })
    setSearch('?other_checkout=complete')

    render(<CheckoutReturnTracker />)

    expect(trackCheckoutAbandoned).toHaveBeenCalledTimes(1)
    expect(trackCheckoutAbandoned).toHaveBeenCalledWith({
      reportId: 'rpt-9',
      plan: 'premium',
      price: 25,
      step: 'returned_without_purchase',
    })
    expect(readCheckoutHandoff()).toBeNull()
  })

  it('reports only once even if the component remounts', () => {
    markCheckoutHandoff({ reportId: 'rpt-9', plan: 'basic', price: 20 })

    const { unmount } = render(<CheckoutReturnTracker />)
    unmount()
    render(<CheckoutReturnTracker />)

    expect(trackCheckoutAbandoned).toHaveBeenCalledTimes(1)
  })
})
