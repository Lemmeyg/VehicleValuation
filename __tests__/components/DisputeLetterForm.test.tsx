import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import DisputeLetterForm from '@/components/DisputeLetterForm'

const mockFetch = jest.fn()
global.fetch = mockFetch

jest.mock('@/lib/analytics/events', () => ({
  trackEvent: jest.fn(),
}))
import { trackEvent } from '@/lib/analytics/events'
const mockTrackEvent = trackEvent as jest.Mock

const mockClick = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ downloadUrl: 'https://signed.url/file.docx' }),
  })
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(mockClick)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('DisputeLetterForm', () => {
  it('renders email input and submit button', () => {
    render(<DisputeLetterForm />)
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download free letter/i })).toBeInTheDocument()
  })

  it('shows inline validation error for invalid email without calling fetch', async () => {
    render(<DisputeLetterForm />)
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'bad-email' },
    })
    fireEvent.click(screen.getByRole('button', { name: /download free letter/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('disables input and button while loading', async () => {
    let resolveRequest!: (v: unknown) => void
    mockFetch.mockReturnValueOnce(
      new Promise(resolve => {
        resolveRequest = resolve
      })
    )

    render(<DisputeLetterForm />)
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /download free letter/i }))

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /email/i })).toBeDisabled()
      expect(screen.getByRole('button')).toBeDisabled()
    })

    await act(async () => {
      resolveRequest({ ok: true, json: async () => ({ downloadUrl: 'https://x.com' }) })
    })
  })

  it('triggers download and shows success state on 200 response', async () => {
    render(<DisputeLetterForm />)
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'user@example.com' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download free letter/i }))
    })
    await waitFor(() => {
      expect(screen.getByText(/your download has started/i)).toBeInTheDocument()
    })
    expect(mockClick).toHaveBeenCalledTimes(1)
  })

  it('fires dispute_letter_downloaded on successful download', async () => {
    render(<DisputeLetterForm />)
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'user@example.com' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download free letter/i }))
    })
    expect(mockTrackEvent).toHaveBeenCalledWith('dispute_letter_downloaded')
  })

  it('does not fire dispute_letter_downloaded when the request fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Something went wrong' }),
    })
    render(<DisputeLetterForm />)
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'user@example.com' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download free letter/i }))
    })
    expect(mockTrackEvent).not.toHaveBeenCalled()
  })

  it('shows API error message on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Too many requests' }),
    })
    render(<DisputeLetterForm />)
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'user@example.com' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download free letter/i }))
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Too many requests')
    })
  })

  it('shows fallback error message when API returns no error string', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    render(<DisputeLetterForm />)
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'user@example.com' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /download free letter/i }))
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i)
    })
  })
})
