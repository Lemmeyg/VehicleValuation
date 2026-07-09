/**
 * @jest-environment node
 */
import { GET } from '@/app/api/auth/session/route'

jest.mock('@/lib/db/supabase')
import { createRouteHandlerSupabaseClient } from '@/lib/db/supabase'

const mockGetUser = jest.fn()
const mockSingle = jest.fn()
const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: mockSingle,
  })),
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(createRouteHandlerSupabaseClient as jest.Mock).mockResolvedValue(mockSupabase)
})

describe('GET /api/auth/session', () => {
  it('calls supabase.auth.getUser(), not getSession()', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    await GET(new Request('http://localhost:3000/api/auth/session'))
    expect(mockGetUser).toHaveBeenCalledTimes(1)
    // Verify getSession is not defined on the mock
    expect('getSession' in mockSupabase.auth).toBe(false)
  })

  it('returns user: null, session: null when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const response = await GET(new Request('http://localhost:3000/api/auth/session'))
    const body = await response.json()
    expect(body).toEqual({ user: null, session: null })
  })

  it('returns the validated user and profile when authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null,
    })
    mockSingle.mockResolvedValue({ data: { full_name: 'Test User' }, error: null })

    const response = await GET(new Request('http://localhost:3000/api/auth/session'))
    const body = await response.json()

    expect(body.user).toEqual({
      id: 'user-1',
      email: 'test@example.com',
      profile: { full_name: 'Test User' },
    })
    expect(body.session).toBeTruthy()
  })

  it('returns 500 when getUser errors', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } })
    const response = await GET(new Request('http://localhost:3000/api/auth/session'))
    expect(response.status).toBe(500)
  })
})
