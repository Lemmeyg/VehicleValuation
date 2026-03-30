import { canViewReport } from '@/lib/utils/report-access'

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
