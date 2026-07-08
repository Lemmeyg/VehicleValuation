import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AuthPage from '@/app/auth/page'

const mockPush = jest.fn()
const mockRefresh = jest.fn()
const mockSearchParams = new URLSearchParams()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => mockSearchParams,
}))

jest.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({
    auth: { signInWithOAuth: jest.fn() },
  }),
}))

const mockTrackAuthEvent = jest.fn()
jest.mock('@/lib/analytics/events', () => ({
  trackAuthEvent: (...args: unknown[]) => mockTrackAuthEvent(...args),
  identifyUser: jest.fn(),
  trackButtonClick: jest.fn(),
}))

jest.mock('@/lib/analytics/reddit-events', () => ({
  trackRedditSignUp: jest.fn(),
}))

describe('AuthPage — signup existing-account fallback (P4)', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockRefresh.mockClear()
    mockTrackAuthEvent.mockClear()
    Array.from(mockSearchParams.keys()).forEach(key => mockSearchParams.delete(key))
    global.fetch = jest.fn()
  })

  async function getToSignupStep(email = 'buyer@example.com') {
    render(<AuthPage />)
    fireEvent.click(screen.getByRole('button', { name: /continue with email/i }))
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: email } })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, hasUser: false, hasReports: false, reportCount: 0 }),
    })
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    await waitFor(() => expect(screen.getByText(/create your account/i)).toBeInTheDocument())
  }

  async function submitSignupForm() {
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
  }

  it('sends a magic link and shows the check-your-email step when signup returns 409', async () => {
    await getToSignupStep()
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Email already registered' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Magic link sent!' }),
      })

    await submitSignupForm()

    await waitFor(() => expect(screen.getByText(/check your email/i)).toBeInTheDocument())
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/auth/magic-link',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('shows a message clarifying the account already existed', async () => {
    await getToSignupStep()
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Email already registered' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Magic link sent!' }),
      })

    await submitSignupForm()

    await waitFor(() => expect(screen.getByText(/already have an account/i)).toBeInTheDocument())
  })

  it('does not treat a non-409 signup failure as an existing account', async () => {
    await getToSignupStep()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Something else went wrong' }),
    })

    await submitSignupForm()

    await waitFor(() => expect(screen.getByText(/something else went wrong/i)).toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledTimes(2) // check-email + signup only, no magic-link call
  })

  it('shows an error and stays on signup step if the fallback magic-link send fails', async () => {
    await getToSignupStep()
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Email already registered' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to send magic link. Please try again.' }),
      })

    await submitSignupForm()

    await waitFor(() => expect(screen.getByText(/failed to send magic link/i)).toBeInTheDocument())
  })

  it('does not leak the "already have an account" message into a later, unrelated magic-link-sent render', async () => {
    // Step 1: trigger the 409 fallback for a@x.com — sets accountAlreadyExisted(true)
    await getToSignupStep('a@x.com')
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Email already registered' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Magic link sent!' }),
      })

    await submitSignupForm()

    await waitFor(() => expect(screen.getByText(/already have an account/i)).toBeInTheDocument())

    // Step 2: use "Use a different email" to go back to the email step
    fireEvent.click(screen.getByRole('button', { name: /use a different email/i }))
    await waitFor(() => expect(screen.getByLabelText(/email address/i)).toBeInTheDocument())

    // Step 3: enter a brand-new email, b@x.com, that has no existing account
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'b@x.com' } })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, hasUser: false, hasReports: false, reportCount: 0 }),
    })
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    await waitFor(() => expect(screen.getByText(/create your account/i)).toBeInTheDocument())

    // Step 4: sign up successfully, requiring email confirmation — lands on magic-link-sent again.
    // Password/confirm-password/terms-checkbox state persisted from the first signup attempt
    // (the "Use a different email" button doesn't reset the form), so re-fill the passwords but
    // don't re-click the already-checked terms checkbox.
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'password123' },
    })
    expect(screen.getByRole('checkbox')).toBeChecked()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, requiresEmailConfirmation: true }),
    })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(screen.getByText(/check your email/i)).toBeInTheDocument())
    expect(screen.queryByText(/already have an account/i)).not.toBeInTheDocument()
  })
})
