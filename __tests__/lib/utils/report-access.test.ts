import { canViewReport, getPaymentGateStatus } from '@/lib/utils/report-access'

describe('canViewReport', () => {
  it('returns true when user is the owner', () => {
    const result = canViewReport('user-123', false, 'user-123')
    expect(result).toBe(true)
  })

  it('returns false when user is not the owner', () => {
    const result = canViewReport('user-123', false, 'user-456')
    expect(result).toBe(false)
  })

  it('returns true when user is admin regardless of ownership', () => {
    const result = canViewReport('user-123', true, 'user-456')
    expect(result).toBe(true)
  })

  it('returns false when reportUserId is null and user is not admin', () => {
    const result = canViewReport('user-123', false, null)
    expect(result).toBe(false)
  })

  it('returns true when reportUserId is null but user is admin', () => {
    const result = canViewReport('user-123', true, null)
    expect(result).toBe(true)
  })
})

describe('getPaymentGateStatus', () => {
  it('allows token access regardless of price_paid or payment records', () => {
    expect(getPaymentGateStatus(true, null, false)).toBe('allowed')
  })

  it('allows a report with a positive price_paid without checking payments', () => {
    expect(getPaymentGateStatus(false, 2900, false)).toBe('allowed')
  })

  it('allows a zero-price_paid report when a succeeded payment exists (admin free report)', () => {
    expect(getPaymentGateStatus(false, 0, true)).toBe('allowed')
  })

  it('returns pending_confirmation for a null-price_paid report with no succeeded payment', () => {
    expect(getPaymentGateStatus(false, null, false)).toBe('pending_confirmation')
  })

  it('returns pending_confirmation for a zero-price_paid report with no succeeded payment', () => {
    expect(getPaymentGateStatus(false, 0, false)).toBe('pending_confirmation')
  })
})
