/**
 * Tests for VehicleValuation component — PostHog analytics tracking + email requirement
 *
 * Covers: form-start tracking, form-submitted tracking (success and failure paths),
 * required email field validation
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
const VALID_EMAIL = 'test@example.com'

async function fillForm({ email = VALID_EMAIL }: { email?: string } = {}) {
  await userEvent.type(screen.getByPlaceholderText(/17-character VIN/i), VALID_VIN)
  await userEvent.type(screen.getByPlaceholderText(/e\.g\., 42000/i), VALID_MILEAGE)
  await userEvent.type(screen.getByPlaceholderText(/e\.g\., 90210/i), VALID_ZIP)
  if (email) {
    await userEvent.type(screen.getByLabelText(/^email$/i), email)
  }
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

describe('VehicleValuation — email field', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupMocks({ loggedIn: true })
  })

  it('renders the email field', () => {
    render(<VehicleValuation />)
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
  })

  it('renders price mention text', () => {
    render(<VehicleValuation />)
    expect(screen.getByText(/reports from \$19/i)).toBeInTheDocument()
  })

  it('renders permission text', () => {
    render(<VehicleValuation />)
    expect(screen.getByText(/agree to receive occasional emails/i)).toBeInTheDocument()
  })

  it('disables submit when email is empty', async () => {
    render(<VehicleValuation />)
    await fillForm({ email: '' })
    expect(screen.getByRole('button', { name: /get your valuation/i })).toBeDisabled()
  })

  it('disables submit when email is invalid', async () => {
    render(<VehicleValuation />)
    await fillForm({ email: 'not-an-email' })
    expect(screen.getByRole('button', { name: /get your valuation/i })).toBeDisabled()
  })

  it('does not call the report-create API when submitted without a valid email', async () => {
    global.fetch = jest.fn()
    render(<VehicleValuation />)
    await fillForm({ email: '' })
    fireEvent.submit(screen.getByLabelText(/^email$/i).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
