/**
 * @jest-environment node
 */
jest.mock('@/lib/db/supabase')
import { createRouteHandlerSupabaseClient, supabaseAdmin } from '@/lib/db/supabase'
import { GET } from '@/app/api/auth/callback/route'

function mockSuccessfulVerifyOtp() {
  const mockVerifyOtp = jest.fn().mockResolvedValue({
    data: { session: { user: { id: 'user-1', email: 'buyer@example.com' } } },
    error: null,
  })
  ;(createRouteHandlerSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { verifyOtp: mockVerifyOtp },
  })
  return mockVerifyOtp
}

describe('GET /api/auth/callback — default redirect (pricing bug fix)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(supabaseAdmin.from as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    })
  })

  it('redirects to home page ("/") when the magic link has no next or reportId param', async () => {
    mockSuccessfulVerifyOtp()

    const request = new Request(
      'http://localhost/api/auth/callback?token_hash=abc123&type=magiclink'
    )
    const response = await GET(request)

    expect(response.headers.get('location')).toBe('http://localhost/')
  })

  it('still redirects to the next param when provided', async () => {
    mockSuccessfulVerifyOtp()

    const request = new Request(
      'http://localhost/api/auth/callback?token_hash=abc123&type=magiclink&next=/reports/abc/view'
    )
    const response = await GET(request)

    expect(response.headers.get('location')).toBe('http://localhost/reports/abc/view')
  })

  it('still redirects to the report page when reportId is provided without next', async () => {
    mockSuccessfulVerifyOtp()

    const request = new Request(
      'http://localhost/api/auth/callback?token_hash=abc123&type=magiclink&reportId=abc'
    )
    const response = await GET(request)

    expect(response.headers.get('location')).toBe('http://localhost/reports/abc')
  })
})
