jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation((url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT: ${url}`), { digest: 'NEXT_REDIRECT' })
  }),
}))

import { redirect } from 'next/navigation'

const getSuccessPage = () => import('@/app/reports/[id]/success/page').then(m => m.default)

describe('/reports/[id]/success — retired, redirects to /view', () => {
  beforeEach(() => jest.clearAllMocks())

  it('redirects to /view preserving the token and checkout query params', async () => {
    const SuccessPage = await getSuccessPage()
    await expect(
      SuccessPage({
        params: Promise.resolve({ id: 'report-1' }),
        searchParams: Promise.resolve({ token: 'tok-1', checkout: 'complete' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT')

    const url = (redirect as jest.Mock).mock.calls[0][0] as string
    expect(url.startsWith('/reports/report-1/view?')).toBe(true)
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('token')).toBe('tok-1')
    expect(params.get('checkout')).toBe('complete')
  })

  it('redirects to /view with no query string when there are no params', async () => {
    const SuccessPage = await getSuccessPage()
    await expect(
      SuccessPage({
        params: Promise.resolve({ id: 'report-1' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(redirect).toHaveBeenCalledWith('/reports/report-1/view')
  })
})
