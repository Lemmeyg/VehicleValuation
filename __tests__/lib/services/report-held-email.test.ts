/**
 * @jest-environment node
 */
import { enrollHeldReportBuyer } from '@/lib/services/report-held-email'
import { supabaseAdmin } from '@/lib/db/supabase'
import { addContactToList } from '@/lib/zoho-campaigns'

jest.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}))
jest.mock('@/lib/zoho-campaigns', () => ({
  addContactToList: jest.fn(),
}))

const mockAdmin = supabaseAdmin as jest.Mocked<typeof supabaseAdmin>
const mockAddContact = addContactToList as jest.MockedFunction<typeof addContactToList>

const LIST_KEY = 'held-list-key'

function mockReportRow(row: Record<string, unknown> | null, fetchError: unknown = null) {
  const updateEq = jest.fn().mockResolvedValue({ error: null })
  const mockUpdate = jest.fn().mockReturnValue({ eq: updateEq })
  mockAdmin.from = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: row, error: fetchError }),
    update: mockUpdate,
  }) as unknown as typeof mockAdmin.from
  return { mockUpdate }
}

const paidRow = {
  email: 'buyer@example.com',
  price_paid: 2500,
  paid_at: '2026-10-01T12:00:00Z',
  vehicle_year: 2015,
  vehicle_make: 'Honda',
  vehicle_model: 'Civic',
  autodev_vin_data: null,
  review_email_enrolled_at: null,
}

describe('enrollHeldReportBuyer', () => {
  const originalKey = process.env.ZOHO_CAMPAIGNS_REPORT_HELD_LIST_KEY

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ZOHO_CAMPAIGNS_REPORT_HELD_LIST_KEY = LIST_KEY
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterAll(() => {
    process.env.ZOHO_CAMPAIGNS_REPORT_HELD_LIST_KEY = originalKey
  })

  it('enrols a paid, held buyer in the Report Held list with Year/Make/Model and stamps review_email_enrolled_at', async () => {
    const { mockUpdate } = mockReportRow(paidRow)
    mockAddContact.mockResolvedValue(true)

    const result = await enrollHeldReportBuyer('report-1')

    expect(result).toBe('enrolled')
    expect(mockAddContact).toHaveBeenCalledWith({
      listKey: LIST_KEY,
      email: 'buyer@example.com',
      customFields: { Year: '2015', Make: 'Honda', Model: 'Civic' },
    })
    expect(mockUpdate).toHaveBeenCalledWith({ review_email_enrolled_at: expect.any(String) })
  })

  it('does not enrol again when review_email_enrolled_at is already set (webhook retry / second hold)', async () => {
    const { mockUpdate } = mockReportRow({
      ...paidRow,
      review_email_enrolled_at: '2026-10-01T12:05:00Z',
    })

    const result = await enrollHeldReportBuyer('report-1')

    expect(result).toBe('skipped')
    expect(mockAddContact).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('does not stamp review_email_enrolled_at when Zoho does not confirm the enrolment', async () => {
    const { mockUpdate } = mockReportRow(paidRow)
    mockAddContact.mockResolvedValue(false)

    const result = await enrollHeldReportBuyer('report-1')

    expect(result).toBe('failed')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('logs and skips (never throws) when the list key env var is missing', async () => {
    delete process.env.ZOHO_CAMPAIGNS_REPORT_HELD_LIST_KEY
    mockReportRow(paidRow)

    const result = await enrollHeldReportBuyer('report-1')

    expect(result).toBe('skipped')
    expect(mockAddContact).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('ZOHO_CAMPAIGNS_REPORT_HELD_LIST_KEY')
    )
  })

  it('skips an unpaid report (e.g. a future admin re-run of a free report)', async () => {
    mockReportRow({ ...paidRow, price_paid: 0, paid_at: null })

    const result = await enrollHeldReportBuyer('report-1')

    expect(result).toBe('skipped')
    expect(mockAddContact).not.toHaveBeenCalled()
  })

  it('treats the report as paid when the caller says so, even before price_paid is written', async () => {
    mockReportRow({ ...paidRow, price_paid: null, paid_at: null })
    mockAddContact.mockResolvedValue(true)

    const result = await enrollHeldReportBuyer('report-1', { paid: true })

    expect(result).toBe('enrolled')
  })

  it('falls back to the payment email and the Auto.dev decode when the row lacks them', async () => {
    mockReportRow({
      ...paidRow,
      email: null,
      vehicle_year: null,
      vehicle_make: null,
      vehicle_model: null,
      autodev_vin_data: { make: 'Pontiac', model: 'Sunfire', vehicle: { year: 2000 } },
    })
    mockAddContact.mockResolvedValue(true)

    await enrollHeldReportBuyer('report-1', { fallbackEmail: 'checkout@example.com' })

    expect(mockAddContact).toHaveBeenCalledWith({
      listKey: LIST_KEY,
      email: 'checkout@example.com',
      customFields: { Year: '2000', Make: 'Pontiac', Model: 'Sunfire' },
    })
  })

  it('skips when there is no email at all', async () => {
    mockReportRow({ ...paidRow, email: null })

    const result = await enrollHeldReportBuyer('report-1')

    expect(result).toBe('skipped')
    expect(mockAddContact).not.toHaveBeenCalled()
  })

  it('never throws when the report fetch fails', async () => {
    mockReportRow(null, { message: 'boom' })

    await expect(enrollHeldReportBuyer('report-1')).resolves.toBe('failed')
    expect(mockAddContact).not.toHaveBeenCalled()
  })

  it('never throws when Zoho itself throws', async () => {
    mockReportRow(paidRow)
    mockAddContact.mockRejectedValue(new Error('network down'))

    await expect(enrollHeldReportBuyer('report-1')).resolves.toBe('failed')
  })
})
