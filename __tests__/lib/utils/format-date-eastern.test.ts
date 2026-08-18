import { formatDateTimeET, formatDateET, formatTimeET } from '@/lib/utils/format-date-eastern'

describe('formatDateTimeET', () => {
  it('renders a summer UTC timestamp in Eastern Daylight Time (UTC-4)', () => {
    // 2026-07-04T12:00:00Z -> 08:00 EDT
    const result = formatDateTimeET('2026-07-04T12:00:00.000Z', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    expect(result).toContain('08:00')
    expect(result).toContain('AM')
  })

  it('renders a winter UTC timestamp in Eastern Standard Time (UTC-5)', () => {
    // 2026-01-04T12:00:00Z -> 07:00 EST
    const result = formatDateTimeET('2026-01-04T12:00:00.000Z', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    expect(result).toContain('07:00')
    expect(result).toContain('AM')
  })

  it('passes through caller-supplied formatting options', () => {
    const result = formatDateTimeET('2026-08-18T15:53:48.907Z', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    // 2026-08-18T15:53:48Z is 11:53 AM EDT
    expect(result).toContain('Aug 18, 2026')
    expect(result).toContain('11:53')
  })
})

describe('formatDateET', () => {
  it('shows the Eastern calendar day even when it differs from the UTC calendar day', () => {
    // 2026-01-01T02:00:00Z is 2025-12-31 21:00 EST — a full day earlier in Eastern time.
    const result = formatDateET('2026-01-01T02:00:00.000Z')
    expect(result).toBe('12/31/2025')
  })
})

describe('formatTimeET', () => {
  it('formats just the time portion in Eastern time', () => {
    const result = formatTimeET('2026-08-18T15:53:48.907Z', { hour: '2-digit', minute: '2-digit' })
    expect(result).toContain('11:53')
  })
})
