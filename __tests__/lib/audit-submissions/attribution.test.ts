import { readAttribution, sanitizeTag } from '@/lib/audit-submissions/attribution'

describe('sanitizeTag', () => {
  it('accepts short link-style tags', () => {
    expect(sanitizeTag('comps_check_outreach')).toBe('comps_check_outreach')
    expect(sanitizeTag(' e3-ps.v1 ')).toBe('e3-ps.v1')
  })

  it('rejects junk, markup, over-long values and non-strings', () => {
    expect(sanitizeTag('<script>')).toBeNull()
    expect(sanitizeTag('has space')).toBeNull()
    expect(sanitizeTag('a'.repeat(65))).toBeNull()
    expect(sanitizeTag('')).toBeNull()
    expect(sanitizeTag(null)).toBeNull()
    expect(sanitizeTag(42)).toBeNull()
  })
})

describe('readAttribution', () => {
  it('reads the channel from utm_campaign and the link version from utm_content', () => {
    expect(
      readAttribution(
        '?utm_source=zoho&utm_campaign=comps_check_report_ready&utm_content=ps-v1',
        'v3'
      )
    ).toEqual({ source: 'comps_check_report_ready', utmContent: 'ps-v1', pageVariant: 'v3' })
  })

  it('falls back to direct and default when tags are missing or junk', () => {
    expect(readAttribution('?utm_campaign=%3Cx%3E', '<bad>')).toEqual({
      source: 'direct',
      utmContent: null,
      pageVariant: 'default',
    })
  })
})
