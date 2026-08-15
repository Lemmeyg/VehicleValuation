/**
 * Tests for Hero component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import Hero from '@/components/Hero'
import { getPostHogDistinctId } from '@/lib/analytics/events'

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))

jest.mock('@/lib/analytics/events', () => ({
  trackVehicleSearch: jest.fn(),
  trackFormSubmission: jest.fn(),
  trackReportWorkflow: jest.fn(),
  trackEmailCapture: jest.fn(),
  getPostHogDistinctId: jest.fn(() => 'ph-distinct-1'),
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

const mockPush = jest.fn()
const VALID_VIN = '1HGCM82633A004352'

const fillValidFieldsExceptEmail = () => {
  fireEvent.change(screen.getByLabelText(/^VIN$/i), { target: { value: VALID_VIN } })
  fireEvent.change(screen.getByLabelText(/mileage/i), { target: { value: '50000' } })
  fireEvent.change(screen.getByLabelText(/zip code/i), { target: { value: '90210' } })
}

describe('Hero', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ report: { id: 'report-1' } }),
    })
    localStorage.clear()
    sessionStorage.clear()
  })

  it('renders the email field', () => {
    render(<Hero />)
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
  })

  it('renders permission text', () => {
    render(<Hero />)
    expect(screen.getByText(/unsubscribe at any time/i)).toBeInTheDocument()
  })

  it('disables submit when email is empty', () => {
    render(<Hero />)
    fillValidFieldsExceptEmail()
    expect(screen.getByRole('button', { name: /get my independent valuation/i })).toBeDisabled()
  })

  it('disables submit when email is invalid', () => {
    render(<Hero />)
    fillValidFieldsExceptEmail()
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'not-an-email' } })
    expect(screen.getByRole('button', { name: /get my independent valuation/i })).toBeDisabled()
  })

  it('enables submit when all fields including a valid email are filled', () => {
    render(<Hero />)
    fillValidFieldsExceptEmail()
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'test@example.com' } })
    expect(screen.getByRole('button', { name: /get my independent valuation/i })).toBeEnabled()
  })

  it('shows a validation warning and does not call create-anonymous when submitted without email', async () => {
    render(<Hero />)
    fillValidFieldsExceptEmail()

    // Submit button is disabled, but the form can still be submitted via Enter/programmatic
    // submit — handleSubmit must independently guard against a missing email.
    fireEvent.submit(screen.getByLabelText(/^email$/i).closest('form')!)

    expect(await screen.findByRole('alert')).toHaveTextContent(/email is required/i)
    expect(
      (global.fetch as jest.Mock).mock.calls.some(
        ([url]) => url === '/api/reports/create-anonymous'
      )
    ).toBe(false)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('calls create-anonymous with email and source, stores pending_report, and redirects on valid submit', async () => {
    render(<Hero />)
    fillValidFieldsExceptEmail()
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: '  Test@Example.com  ' },
    })

    fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/reports/create-anonymous',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            vin: VALID_VIN,
            mileage: 50000,
            zipCode: '90210',
            email: 'test@example.com',
            source: 'homepage',
            posthogDistinctId: 'ph-distinct-1',
          }),
        })
      )
    })

    expect(sessionStorage.getItem('pending_report')).toBe(JSON.stringify({ id: 'report-1' }))
    expect(mockPush).toHaveBeenCalledWith('/pricing')
  })

  // BL-125: captured here, at submission, because it is guaranteed to happen and
  // happens long before the report-delivery email goes out.
  describe('posthog distinct id capture (BL-125)', () => {
    it('sends the visitor PostHog distinct id when creating the report', async () => {
      render(<Hero />)
      fillValidFieldsExceptEmail()
      fireEvent.change(screen.getByLabelText(/^email$/i), {
        target: { value: 'test@example.com' },
      })
      fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))

      await waitFor(() => {
        const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
        expect(body.posthogDistinctId).toBe('ph-distinct-1')
      })
    })

    it('omits the field and still submits when the distinct id is unavailable', async () => {
      ;(getPostHogDistinctId as jest.Mock).mockReturnValueOnce(null)

      render(<Hero />)
      fillValidFieldsExceptEmail()
      fireEvent.change(screen.getByLabelText(/^email$/i), {
        target: { value: 'test@example.com' },
      })
      fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))

      await waitFor(() => {
        const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
        expect(body).not.toHaveProperty('posthogDistinctId')
        expect(body.vin).toBe(VALID_VIN)
      })
    })
  })

  it('shows a submit error and does not redirect when create-anonymous fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Failed to create report. Please try again.' }),
    })
    render(<Hero />)
    fillValidFieldsExceptEmail()
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'test@example.com' } })

    fireEvent.click(screen.getByRole('button', { name: /get my independent valuation/i }))

    await waitFor(() => {
      expect(screen.getByText(/failed to create report/i)).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })
})
