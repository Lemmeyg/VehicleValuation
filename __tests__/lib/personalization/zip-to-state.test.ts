import { resolveStateCodeFromZip } from '@/lib/personalization/zip-to-state'

describe('resolveStateCodeFromZip', () => {
  it('resolves a real ZIP to its 2-letter state code', () => {
    expect(resolveStateCodeFromZip('19104')).toBe('PA')
  })

  it('resolves a ZIP+4 by using only the first 5 digits', () => {
    expect(resolveStateCodeFromZip('19104-1234')).toBe('PA')
  })

  it('returns null for a ZIP with no state assignment', () => {
    expect(resolveStateCodeFromZip('00000')).toBeNull()
  })

  it('returns null for null input', () => {
    expect(resolveStateCodeFromZip(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(resolveStateCodeFromZip(undefined)).toBeNull()
  })
})
