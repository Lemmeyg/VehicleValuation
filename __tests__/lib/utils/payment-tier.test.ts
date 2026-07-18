import { getPaidReportType } from '@/lib/utils/payment-tier'

function makeSupabaseMock(row: { metadata?: { reportType?: string } } | null) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: row, error: null })
  const limit = jest.fn().mockReturnValue({ maybeSingle })
  const order = jest.fn().mockReturnValue({ limit })
  const eqStatus = jest.fn().mockReturnValue({ order })
  const eqReportId = jest.fn().mockReturnValue({ eq: eqStatus })
  const select = jest.fn().mockReturnValue({ eq: eqReportId })
  const from = jest.fn().mockReturnValue({ select })
  return { from, select, eqReportId, eqStatus, order, limit, maybeSingle }
}

describe('getPaidReportType', () => {
  it('returns PREMIUM when the most recent succeeded payment metadata says PREMIUM', async () => {
    const supabase = makeSupabaseMock({ metadata: { reportType: 'PREMIUM' } })

    const result = await getPaidReportType(supabase, 'report-1')

    expect(result).toBe('PREMIUM')
    expect(supabase.from).toHaveBeenCalledWith('payments')
    expect(supabase.eqReportId).toHaveBeenCalledWith('report_id', 'report-1')
    expect(supabase.eqStatus).toHaveBeenCalledWith('status', 'succeeded')
  })

  it('returns BASIC when the most recent succeeded payment metadata says BASIC', async () => {
    const supabase = makeSupabaseMock({ metadata: { reportType: 'BASIC' } })

    const result = await getPaidReportType(supabase, 'report-1')

    expect(result).toBe('BASIC')
  })

  it('returns null when there is no succeeded payment row', async () => {
    const supabase = makeSupabaseMock(null)

    const result = await getPaidReportType(supabase, 'report-1')

    expect(result).toBeNull()
  })

  it('returns null when metadata.reportType is neither BASIC nor PREMIUM (e.g. admin free reports)', async () => {
    const supabase = makeSupabaseMock({ metadata: { reportType: 'admin' } })

    const result = await getPaidReportType(supabase, 'report-1')

    expect(result).toBeNull()
  })
})
