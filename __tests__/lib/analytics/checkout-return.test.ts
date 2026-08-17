import {
  markCheckoutHandoff,
  readCheckoutHandoff,
  clearCheckoutHandoff,
} from '@/lib/analytics/checkout-return'

describe('checkout handoff marker', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when no handoff was recorded', () => {
    expect(readCheckoutHandoff()).toBeNull()
  })

  it('round-trips a handoff and stamps it with a time', () => {
    markCheckoutHandoff({ reportId: 'rpt-1', plan: 'premium', price: 25 })

    const handoff = readCheckoutHandoff()
    expect(handoff).not.toBeNull()
    expect(handoff!.reportId).toBe('rpt-1')
    expect(handoff!.plan).toBe('premium')
    expect(handoff!.price).toBe(25)
    expect(typeof handoff!.at).toBe('number')
  })

  it('clears the handoff', () => {
    markCheckoutHandoff({ reportId: 'rpt-1', plan: 'basic', price: 20 })
    clearCheckoutHandoff()
    expect(readCheckoutHandoff()).toBeNull()
  })

  it('returns null and clears the key when stored data is corrupt', () => {
    localStorage.setItem('tlt_checkout_handoff', 'not json')
    expect(readCheckoutHandoff()).toBeNull()
    expect(localStorage.getItem('tlt_checkout_handoff')).toBeNull()
  })

  it('returns null for a handoff older than the 6 hour window', () => {
    const stale = {
      reportId: 'rpt-1',
      plan: 'basic',
      price: 20,
      at: Date.now() - 7 * 60 * 60 * 1000,
    }
    localStorage.setItem('tlt_checkout_handoff', JSON.stringify(stale))
    expect(readCheckoutHandoff()).toBeNull()
  })
})
