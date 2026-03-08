import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NewReportPage from '@/app/reports/new/page'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockTrackEvent = jest.fn()
jest.mock('@/lib/analytics/events', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}))

const mockGetKBAttribution = jest.fn()
jest.mock('@/lib/analytics/kb-attribution', () => ({
  getKBAttribution: () => mockGetKBAttribution(),
}))

// Minimal fetch mock: returns a successful report
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ report: { id: 'report-123' } }),
}) as jest.Mock

describe('NewReportPage', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockTrackEvent.mockClear()
    mockGetKBAttribution.mockReturnValue(null)
    ;(global.fetch as jest.Mock).mockClear()
  })

  async function fillAndSubmit() {
    render(<NewReportPage />)
    fireEvent.change(screen.getByLabelText(/Vehicle Identification Number/i), {
      target: { value: '1HGBH41JXMN109186' },
    })
    fireEvent.change(screen.getByLabelText(/Current Mileage/i), {
      target: { value: '42000' },
    })
    fireEvent.change(screen.getByLabelText(/ZIP Code/i), {
      target: { value: '90210' },
    })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => expect(mockPush).toHaveBeenCalled())
  }

  it('fires kb_vin_form_submitted on successful submission', async () => {
    await fillAndSubmit()

    expect(mockTrackEvent).toHaveBeenCalledWith('kb_vin_form_submitted', expect.any(Object))
  })

  it('includes kb_source_slug when KB attribution is present', async () => {
    mockGetKBAttribution.mockReturnValue({
      slug: 'challenge-comps',
      title: 'How to Challenge Comps',
      visited_at: '2026-03-02T00:00:00Z',
    })

    await fillAndSubmit()

    expect(mockTrackEvent).toHaveBeenCalledWith('kb_vin_form_submitted', {
      kb_source_slug: 'challenge-comps',
      kb_source_title: 'How to Challenge Comps',
      kb_source_visited_at: '2026-03-02T00:00:00Z',
    })
  })

  it('fires kb_vin_form_submitted with empty object when no KB attribution', async () => {
    mockGetKBAttribution.mockReturnValue(null)

    await fillAndSubmit()

    expect(mockTrackEvent).toHaveBeenCalledWith('kb_vin_form_submitted', {})
  })
})
