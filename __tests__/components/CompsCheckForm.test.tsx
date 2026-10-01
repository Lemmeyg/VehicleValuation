import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CompsCheckForm from '@/components/CompsCheckForm'

const mockFetch = jest.fn()
global.fetch = mockFetch

jest.mock('@/lib/analytics/events', () => ({
  trackAuditPageViewed: jest.fn(),
  trackAuditFormError: jest.fn(),
  getPostHogDistinctId: jest.fn(() => 'browser-person-1'),
}))
import { trackAuditPageViewed, trackAuditFormError } from '@/lib/analytics/events'
const mockPageViewed = trackAuditPageViewed as jest.Mock
const mockFormError = trackAuditFormError as jest.Mock

function makeBigPhoto() {
  const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
  Object.defineProperty(file, 'size', { value: 4 * 1024 * 1024 })
  return file
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: 'user@example.com' },
  })
  fireEvent.change(screen.getByLabelText(/insurer's report/i), {
    target: { files: [makePdfFile()] },
  })
  fireEvent.click(screen.getByRole('checkbox'))
}

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
    expect(mockFormError).toHaveBeenCalledWith('invalid_email', expect.any(Object))
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
    expect(mockFormError).toHaveBeenCalledWith('server_rejected_400', expect.any(Object))
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
      expect(screen.getByText(/over the 3MB limit/i)).toBeInTheDocument()
    })
    expect(mockFormError).toHaveBeenCalledWith('server_rejected_413', expect.any(Object))
  })

  it('tags the page view with the channel, link version and page variant from the URL', () => {
    window.history.pushState(
      {},
      '',
      '/comps-check?utm_campaign=comps_check_outreach&utm_content=send-1'
    )
    render(<CompsCheckForm pageVariant="v2" />)
    expect(mockPageViewed).toHaveBeenCalledWith({
      source: 'comps_check_outreach',
      utmContent: 'send-1',
      pageVariant: 'v2',
    })
    window.history.pushState({}, '', '/')
  })

  it('tags a visit with no campaign as direct', () => {
    render(<CompsCheckForm />)
    expect(mockPageViewed).toHaveBeenCalledWith({
      source: 'direct',
      utmContent: null,
      pageVariant: 'default',
    })
  })

  it('sends the tags and the browser distinct id with the upload', async () => {
    window.history.pushState({}, '', '/comps-check?utm_campaign=comps_check_drip_e3')
    render(<CompsCheckForm pageVariant="v2" />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    const body = mockFetch.mock.calls[0][1].body as FormData
    expect(body.get('source')).toBe('comps_check_drip_e3')
    expect(body.get('page_variant')).toBe('v2')
    expect(body.get('utm_content')).toBeNull()
    expect(body.get('ph_distinct_id')).toBe('browser-person-1')
    window.history.pushState({}, '', '/')
  })

  it('shows the 3MB limit before anyone picks a file', () => {
    render(<CompsCheckForm />)
    expect(screen.getByText(/up to 3mb/i)).toBeInTheDocument()
  })

  it('warns about an oversized photo as soon as it is picked, with a specific error code', () => {
    render(<CompsCheckForm />)
    fireEvent.change(screen.getByLabelText(/insurer's report/i), {
      target: { files: [makeBigPhoto()] },
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/over the 3MB limit/i)
    expect(mockFormError).toHaveBeenCalledWith('file_too_large', expect.any(Object))
  })

  it('clears the size warning when a smaller file is picked', () => {
    render(<CompsCheckForm />)
    const input = screen.getByLabelText(/insurer's report/i)
    fireEvent.change(input, { target: { files: [makeBigPhoto()] } })
    fireEvent.change(input, { target: { files: [makePdfFile()] } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reports missing consent with its own error code', () => {
    render(<CompsCheckForm />)
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/insurer's report/i), {
      target: { files: [makePdfFile()] },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    expect(mockFormError).toHaveBeenCalledWith('missing_consent', expect.any(Object))
  })

  it('uses the submit label from the copy slot', () => {
    render(<CompsCheckForm submitLabel="Check my report" />)
    expect(screen.getByRole('button', { name: 'Check my report' })).toBeInTheDocument()
  })

  it('marks the success message so a PostHog survey can target it', async () => {
    const { container } = render(<CompsCheckForm />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    await waitFor(() => {
      expect(container.querySelector('#comps-check-success')).toBeInTheDocument()
    })
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
