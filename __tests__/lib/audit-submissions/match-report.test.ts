jest.mock('@/lib/db/supabase')
import { supabaseAdmin } from '@/lib/db/supabase'
import { findMatchingReportId } from '@/lib/audit-submissions/match-report'

function mockQueryResult(data: unknown, error: unknown = null) {
  const maybeSingle = jest.fn().mockResolvedValue({ data, error })
  const limit = jest.fn().mockReturnValue({ maybeSingle })
  const order = jest.fn().mockReturnValue({ limit })
  const gt = jest.fn().mockReturnValue({ order })
  const ilike = jest.fn().mockReturnValue({ gt })
  const select = jest.fn().mockReturnValue({ ilike })
  ;(supabaseAdmin.from as jest.Mock).mockReturnValue({ select })
  return { select, ilike, gt, order, limit, maybeSingle }
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(supabaseAdmin as unknown as { from: jest.Mock }).from = jest.fn()
})

describe('findMatchingReportId', () => {
  it('returns the matched report id when a paid report exists for the email', async () => {
    mockQueryResult({ id: 'report-123' })
    const result = await findMatchingReportId('user@example.com')
    expect(result).toBe('report-123')
  })

  it('queries reports case-insensitively and only for paid reports', async () => {
    const { ilike, gt } = mockQueryResult({ id: 'report-123' })
    await findMatchingReportId('User@Example.com')
    expect(ilike).toHaveBeenCalledWith('email', 'User@Example.com')
    expect(gt).toHaveBeenCalledWith('price_paid', 0)
  })

  it('returns null when no matching report exists', async () => {
    mockQueryResult(null)
    const result = await findMatchingReportId('nomatch@example.com')
    expect(result).toBeNull()
  })

  it('returns null when the query errors, without throwing', async () => {
    mockQueryResult(null, { message: 'DB error' })
    const result = await findMatchingReportId('user@example.com')
    expect(result).toBeNull()
  })

  it('returns null instead of rejecting when the Supabase chain throws synchronously', async () => {
    const select = jest.fn(() => {
      throw new Error('unexpected synchronous failure')
    })
    ;(supabaseAdmin.from as jest.Mock).mockReturnValue({ select })
    await expect(findMatchingReportId('user@example.com')).resolves.toBeNull()
  })
})
