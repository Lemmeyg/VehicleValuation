/**
 * Tests for VehicleValuation component — PostHog analytics tracking
 *
 * Covers: form-start tracking, form-submitted tracking (success and failure paths)
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import VehicleValuation from '@/components/VehicleValuation'
import { useAuth } from '@/hooks/useAuth'

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }))
jest.mock('posthog-js', () => ({ __loaded: true, capture: jest.fn() }))
jest.mock('@/lib/analytics/kb-attribution', () => ({
  getKBAttribution: jest.fn().mockReturnValue(null),
}))
jest.mock('@/components/AuthModal', () => ({
  __esModule: true,
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="auth-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}))

const mockPush = jest.fn()
const mockPosthog = posthog as jest.Mocked<typeof posthog>

function setupMocks({ loggedIn = false } = {}) {
  ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
  ;(useAuth as jest.Mock).mockReturnValue({ user: loggedIn ? { id: 'user-1' } : null })
}

const VALID_VIN = '1HGBH41JXMN109186'
const VALID_MILEAGE = '42000'
const VALID_ZIP = '90210'

async function fillForm() {
  await userEvent.type(screen.getByPlaceholderText(/17-character VIN/i), VALID_VIN)
  await userEvent.type(screen.getByPlaceholderText(/e\.g\., 42000/i), VALID_MILEAGE)
  await userEvent.type(screen.getByPlaceholderText(/e\.g\., 90210/i), VALID_ZIP)
}

describe('VehicleValuation analytics tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fires bottom_form_started on first field interaction', async () => {
    setupMocks()
    render(<VehicleValuation />)
    await userEvent.type(screen.getByPlaceholderText(/17-character VIN/i), 'A')
    expect(mockPosthog.capture).toHaveBeenCalledWith(
      'report_workflow',
      expect.objectContaining({ step: 'bottom_form_started' })
    )
  })

  it('fires bottom_form_started only once across multiple field interactions', async () => {
    setupMocks()
    render(<VehicleValuation />)
    await userEvent.type(screen.getByPlaceholderText(/17-character VIN/i), 'A')
    await userEvent.type(screen.getByPlaceholderText(/e\.g\., 42000/i), '1')
    const formStartedCalls = mockPosthog.capture.mock.calls.filter(
      ([name, props]: [string, Record<string, unknown>]) =>
        name === 'report_workflow' && props?.step === 'bottom_form_started'
    )
    expect(formStartedCalls).toHaveLength(1)
  })

  it('fires form_submitted with success:true after successful API call', async () => {
    setupMocks({ loggedIn: true })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ report: { id: 'report-123' } }),
    })
    render(<VehicleValuation />)
    await fillForm()
    fireEvent.click(screen.getByRole('button', { name: /get your valuation/i }))
    await waitFor(() => expect(mockPush).toHaveBeenCalled())
    expect(mockPosthog.capture).toHaveBeenCalledWith(
      'form_submitted',
      expect.objectContaining({ form: 'bottom_vehicle_form', success: true })
    )
  })

  it('fires report_workflow bottom_form_submitted after successful API call', async () => {
    setupMocks({ loggedIn: true })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ report: { id: 'report-123' } }),
    })
    render(<VehicleValuation />)
    await fillForm()
    fireEvent.click(screen.getByRole('button', { name: /get your valuation/i }))
    await waitFor(() => expect(mockPush).toHaveBeenCalled())
    expect(mockPosthog.capture).toHaveBeenCalledWith(
      'report_workflow',
      expect.objectContaining({ step: 'bottom_form_submitted' })
    )
  })

  it('fires form_submitted with success:false when API returns error', async () => {
    setupMocks({ loggedIn: true })
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Something went wrong' }),
    })
    render(<VehicleValuation />)
    await fillForm()
    fireEvent.click(screen.getByRole('button', { name: /get your valuation/i }))
    await waitFor(() => screen.getByText(/something went wrong/i))
    expect(mockPosthog.capture).toHaveBeenCalledWith(
      'form_submitted',
      expect.objectContaining({ form: 'bottom_vehicle_form', success: false })
    )
  })
})
