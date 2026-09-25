import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CompsCheckForm from '@/components/CompsCheckForm'

const mockFetch = jest.fn()
global.fetch = mockFetch

jest.mock('@/lib/analytics/events', () => ({
  trackAuditPageViewed: jest.fn(),
  trackAuditFormError: jest.fn(),
}))
import { trackAuditPageViewed, trackAuditFormError } from '@/lib/analytics/events'
const mockPageViewed = trackAuditPageViewed as jest.Mock
const mockFormError = trackAuditFormError as jest.Mock

function makePdfFile() {
  return new File(['%PDF-1.4 content'], 'report.pdf', { type: 'application/pdf' })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
})

describe('CompsCheckForm', () => {
  it('fires trackAuditPageViewed on mount', () => {
    render(<CompsCheckForm />)
    expect(mockPageViewed).toHaveBeenCalledTimes(1)
  })

  it('renders email, file, note, and consent fields', () => {
    render(<CompsCheckForm />)
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/insurer's report/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/anything else/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('includes a hidden honeypot field named company_website', () => {
    const { container } = render(<CompsCheckForm />)
    const honeypot = container.querySelector('input[name="company_website"]')
    expect(honeypot).toBeInTheDocument()
    expect(honeypot).toHaveAttribute('tabIndex', '-1')
  })

  it('submits whatever a bot writes into the honeypot field, not a hardcoded empty string', async () => {
    const { container } = render(<CompsCheckForm />)
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/insurer's report/i), {
      target: { files: [makePdfFile()] },
    })
    fireEvent.click(screen.getByRole('checkbox'))

    const honeypot = container.querySelector('input[name="company_website"]') as HTMLInputElement
    fireEvent.change(honeypot, { target: { value: 'http://spam.example' } })

    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
    const body = mockFetch.mock.calls[0][1].body as FormData
    expect(body.get('company_website')).toBe('http://spam.example')
  })

  it('shows a validation error and does not call fetch when email is invalid', () => {
    render(<CompsCheckForm />)
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'bad-email' } })
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockFormError).toHaveBeenCalledWith('client_validation')
  })

  it('shows a validation error when consent is not checked', () => {
    render(<CompsCheckForm />)
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'user@example.com' },
    })
    const fileInput = screen.getByLabelText(/insurer's report/i) as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [makePdfFile()] } })
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('submits successfully with valid data and shows the confirmation message', async () => {
    render(<CompsCheckForm />)
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/insurer's report/i), {
      target: { files: [makePdfFile()] },
    })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/we'll review this and get back to you within 48 hours/i)
      ).toBeInTheDocument()
    })
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/audit-submissions',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('shows the server error message and fires trackAuditFormError with the HTTP status when the API rejects the submission', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'This file could not be accepted.' }),
    })
    render(<CompsCheckForm />)
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/insurer's report/i), {
      target: { files: [makePdfFile()] },
    })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))

    await waitFor(() => {
      expect(screen.getByText('This file could not be accepted.')).toBeInTheDocument()
    })
    expect(mockFormError).toHaveBeenCalledWith('server_rejected_400')
  })

  it('falls back to a generic error message and still classifies it as a server error when the error response body is not valid JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: async () => {
        throw new SyntaxError('Unexpected token in JSON')
      },
    })
    render(<CompsCheckForm />)
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/insurer's report/i), {
      target: { files: [makePdfFile()] },
    })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
    })
    expect(mockFormError).toHaveBeenCalledWith('server_rejected_413')
  })

  it('trims trailing whitespace before validating the email', () => {
    render(<CompsCheckForm />)
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'user@example.com ' },
    })
    fireEvent.change(screen.getByLabelText(/insurer's report/i), {
      target: { files: [makePdfFile()] },
    })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
