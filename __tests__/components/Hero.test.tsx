/**
 * Tests for Hero component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Hero from '@/components/Hero'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/lib/analytics/events', () => ({
  trackVehicleSearch: jest.fn(),
  trackFormSubmission: jest.fn(),
  trackReportWorkflow: jest.fn(),
  trackEmailCapture: jest.fn(),
}))

jest.mock('@/lib/analytics/reddit-events', () => ({
  trackRedditLead: jest.fn(),
}))

jest.mock('@/components/ReportPreviewCondensed', () => {
  function MockReportPreviewCondensed() {
    return <div data-testid="report-preview" />
  }
  return MockReportPreviewCondensed
})

jest.mock('@/lib/feature-flags', () => ({
  isEmailCaptureEnabled: jest.fn().mockReturnValue(false),
}))

import { isEmailCaptureEnabled } from '@/lib/feature-flags'
const mockIsEmailCaptureEnabled = isEmailCaptureEnabled as jest.Mock

const VALID_VIN = '1HGCM82633A004352'

describe('Hero — email capture disabled (default)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsEmailCaptureEnabled.mockReturnValue(false)
  })

  it('does not show "no credit card required" text', () => {
    render(<Hero />)
    expect(screen.queryByText(/no credit card/i)).not.toBeInTheDocument()
  })

  it('shows "Takes 60 seconds" microcopy', () => {
    render(<Hero />)
    expect(screen.getByText(/takes 60 seconds/i)).toBeInTheDocument()
  })

  it('does not render email field when feature is off', () => {
    render(<Hero />)
    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument()
  })

  it('does not render price mention when feature is off', () => {
    render(<Hero />)
    expect(screen.queryByText(/reports from \$19/i)).not.toBeInTheDocument()
  })

  it('does not render permission text when feature is off', () => {
    render(<Hero />)
    expect(screen.queryByText(/agree to receive/i)).not.toBeInTheDocument()
  })
})

describe('Hero — email capture enabled', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsEmailCaptureEnabled.mockReturnValue(true)
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  })

  it('renders the email field', () => {
    render(<Hero />)
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
  })

  it('marks the email field as optional', () => {
    render(<Hero />)
    expect(screen.getByText(/optional/i)).toBeInTheDocument()
  })

  it('renders price mention text', () => {
    render(<Hero />)
    expect(screen.getByText(/reports from \$19/i)).toBeInTheDocument()
  })

  it('renders permission text', () => {
    render(<Hero />)
    expect(screen.getByText(/agree to receive occasional emails/i)).toBeInTheDocument()
  })

  it('calls /api/leads/capture when email is provided on submit', async () => {
    render(<Hero />)

    fireEvent.change(screen.getByLabelText(/^VIN$/i), {
      target: { value: VALID_VIN },
    })
    fireEvent.change(screen.getByLabelText(/mileage/i), { target: { value: '50000' } })
    fireEvent.change(screen.getByLabelText(/zip code/i), { target: { value: '90210' } })
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    })

    fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/leads/capture',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@example.com' }),
        })
      )
    })
  })

  it('does not call /api/leads/capture when email is empty', async () => {
    render(<Hero />)

    fireEvent.change(screen.getByLabelText(/^VIN$/i), { target: { value: VALID_VIN } })
    fireEvent.change(screen.getByLabelText(/mileage/i), { target: { value: '50000' } })
    fireEvent.change(screen.getByLabelText(/zip code/i), { target: { value: '90210' } })

    fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))

    await waitFor(() => {
      expect(
        (global.fetch as jest.Mock).mock.calls.some(([url]) => url === '/api/leads/capture')
      ).toBe(false)
    })
  })
})
