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

const VALID_VIN = '1HGCM82633A004352'

const fillValidFieldsExceptEmail = () => {
  fireEvent.change(screen.getByLabelText(/^VIN$/i), { target: { value: VALID_VIN } })
  fireEvent.change(screen.getByLabelText(/mileage/i), { target: { value: '50000' } })
  fireEvent.change(screen.getByLabelText(/zip code/i), { target: { value: '90210' } })
}

describe('Hero', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  })

  it('renders the email field', () => {
    render(<Hero />)
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
  })

  it('renders permission text', () => {
    render(<Hero />)
    expect(screen.getByText(/agree to receive occasional emails/i)).toBeInTheDocument()
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

  it('shows a validation warning and does not call /api/leads/capture when submitted without email', async () => {
    render(<Hero />)
    fillValidFieldsExceptEmail()

    // Submit button is disabled, but the form can still be submitted via Enter/programmatic
    // submit — handleSubmit must independently guard against a missing email.
    fireEvent.submit(screen.getByLabelText(/^email$/i).closest('form')!)

    expect(await screen.findByRole('alert')).toHaveTextContent(/email is required/i)
    expect(
      (global.fetch as jest.Mock).mock.calls.some(([url]) => url === '/api/leads/capture')
    ).toBe(false)
  })

  it('calls /api/leads/capture with the sanitized email and stores it for the pricing page on valid submit', async () => {
    render(<Hero />)
    fillValidFieldsExceptEmail()
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: '  Test@Example.com  ' },
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

    const stored = JSON.parse(localStorage.getItem('hero_form_data') || '{}')
    expect(stored.email).toBe('test@example.com')
  })
})
