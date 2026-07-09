import { render, waitFor } from '@testing-library/react'
import AuthCallbackPage from '@/app/auth/callback/page'

const mockPush = jest.fn()
const mockSearchParams = new URLSearchParams()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}))

const mockVerifyOtp = jest.fn()
const mockSetSession = jest.fn()
const mockGetSession = jest.fn()
jest.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({
    auth: {
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      setSession: (...args: unknown[]) => mockSetSession(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  }),
}))

const SESSION_RESULT = {
  data: { session: { user: { id: 'user-1', email: 'buyer@example.com' } } },
  error: null,
}

describe('AuthCallbackPage — default redirect (pricing bug fix)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    Array.from(mockSearchParams.keys()).forEach(key => mockSearchParams.delete(key))
    localStorage.clear()
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 0 }) })
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
    // Reset the hash on the real jsdom Location object directly. Both approaches
    // the brief suggested for *replacing* window.location wholesale fail in this
    // project's jsdom version:
    // - `delete` + direct reassignment: the real Location setter intercepts the
    //   assignment (setting `href` triggers full navigation) and throws internally
    //   ("Not implemented: navigation") without actually replacing the property,
    //   so state silently fails to reset and leaks across tests.
    // - Object.defineProperty to swap in a plain object: jsdom's Window only
    //   allows `location` to be redefined once ever (even a single module-scope
    //   call throws "TypeError: Cannot redefine property: location" — the preset's
    //   env.setup already touches it once), so a per-test or even one-time swap
    //   isn't viable here.
    // jsdom's own error message says hash-only changes ARE implemented
    // ("Not implemented: navigation (except hash changes)"), so mutating
    // `.hash` on the real Location object works without any workaround.
    window.location.hash = ''
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('redirects to home page via the token_hash flow when no next/reportId is present', async () => {
    mockSearchParams.set('token_hash', 'abc123')
    mockSearchParams.set('type', 'magiclink')
    mockVerifyOtp.mockResolvedValue(SESSION_RESULT)

    render(<AuthCallbackPage />)
    await waitFor(() => expect(mockVerifyOtp).toHaveBeenCalled())
    jest.advanceTimersByTime(1000)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'))
  })

  it('redirects to home page via the hash-params flow when no next/reportId is present', async () => {
    window.location.hash = '#access_token=tok123&refresh_token=ref456'
    mockSetSession.mockResolvedValue(SESSION_RESULT)

    render(<AuthCallbackPage />)
    await waitFor(() => expect(mockSetSession).toHaveBeenCalled())
    jest.advanceTimersByTime(1000)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'))
  })

  it('redirects to home page via the fallback getSession flow when no next/reportId is present', async () => {
    mockGetSession.mockResolvedValue(SESSION_RESULT)

    render(<AuthCallbackPage />)
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled())
    jest.advanceTimersByTime(1000)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'))
  })

  it('still redirects to next when provided (token_hash flow)', async () => {
    mockSearchParams.set('token_hash', 'abc123')
    mockSearchParams.set('type', 'magiclink')
    mockSearchParams.set('next', '/reports/abc/view')
    mockVerifyOtp.mockResolvedValue(SESSION_RESULT)

    render(<AuthCallbackPage />)
    await waitFor(() => expect(mockVerifyOtp).toHaveBeenCalled())
    jest.advanceTimersByTime(1000)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/reports/abc/view'))
  })
})
