/**
 * @jest-environment node
 */
import { addContactToList } from '@/lib/zoho-campaigns'

describe('addContactToList (Zoho Campaigns)', () => {
  const ORIG_ID = process.env.ZOHO_CAMPAIGNS_CLIENT_ID
  const ORIG_SECRET = process.env.ZOHO_CAMPAIGNS_CLIENT_SECRET
  const ORIG_REFRESH = process.env.ZOHO_CAMPAIGNS_REFRESH_TOKEN

  beforeEach(() => {
    process.env.ZOHO_CAMPAIGNS_CLIENT_ID = 'test-client-id'
    process.env.ZOHO_CAMPAIGNS_CLIENT_SECRET = 'test-client-secret'
    process.env.ZOHO_CAMPAIGNS_REFRESH_TOKEN = 'test-refresh-token'

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.toString().includes('accounts.zoho.com')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'test-access-token' }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, text: async () => '{"status":"success"}' })
    })
  })

  afterEach(() => {
    if (ORIG_ID === undefined) delete process.env.ZOHO_CAMPAIGNS_CLIENT_ID
    else process.env.ZOHO_CAMPAIGNS_CLIENT_ID = ORIG_ID
    if (ORIG_SECRET === undefined) delete process.env.ZOHO_CAMPAIGNS_CLIENT_SECRET
    else process.env.ZOHO_CAMPAIGNS_CLIENT_SECRET = ORIG_SECRET
    if (ORIG_REFRESH === undefined) delete process.env.ZOHO_CAMPAIGNS_REFRESH_TOKEN
    else process.env.ZOHO_CAMPAIGNS_REFRESH_TOKEN = ORIG_REFRESH
  })

  it('refreshes an access token from accounts.zoho.com before adding a contact', async () => {
    await addContactToList({ listKey: 'list-key-1', email: 'user@example.com' })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://accounts.zoho.com/oauth/v2/token'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('posts to the listsubscribe endpoint with the access token and list key', async () => {
    await addContactToList({ listKey: 'list-key-1', email: 'user@example.com' })

    const calls = (global.fetch as jest.Mock).mock.calls
    const subscribeCall = calls.find(c => c[0].toString().includes('listsubscribe'))
    expect(subscribeCall).toBeDefined()
    expect(subscribeCall[0]).toContain('listkey=list-key-1')
    expect(subscribeCall[1].headers.Authorization).toBe('Zoho-oauthtoken test-access-token')
  })

  it('includes the email and custom fields in contactinfo', async () => {
    await addContactToList({
      listKey: 'list-key-1',
      email: 'user@example.com',
      customFields: { VIN: '1HGBH41JXMN109186' },
    })

    const calls = (global.fetch as jest.Mock).mock.calls
    const subscribeCall = calls.find(c => c[0].toString().includes('listsubscribe'))
    const url = new URL(subscribeCall[0])
    const contactInfo = JSON.parse(url.searchParams.get('contactinfo') as string)
    expect(contactInfo['Contact Email']).toBe('user@example.com')
    expect(contactInfo.VIN).toBe('1HGBH41JXMN109186')
  })

  it('does not call fetch when ZOHO_CAMPAIGNS_CLIENT_ID is missing', async () => {
    delete process.env.ZOHO_CAMPAIGNS_CLIENT_ID
    await addContactToList({ listKey: 'list-key-1', email: 'user@example.com' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('does not call listsubscribe when the token refresh response has no access_token', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
    await addContactToList({ listKey: 'list-key-1', email: 'user@example.com' })
    expect(global.fetch).toHaveBeenCalledTimes(1) // only the token refresh, no listsubscribe
  })

  it('does not call listsubscribe when the token refresh response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    })
    await addContactToList({ listKey: 'list-key-1', email: 'user@example.com' })
    expect(global.fetch).toHaveBeenCalledTimes(1) // only the token refresh, no listsubscribe
  })

  it('resolves without throwing when the token refresh fetch rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'))
    await expect(
      addContactToList({ listKey: 'list-key-1', email: 'user@example.com' })
    ).resolves.not.toThrow()
  })

  it('resolves without throwing when listsubscribe returns a non-ok response', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.toString().includes('accounts.zoho.com')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'tok' }),
        })
      }
      return Promise.resolve({ ok: false, status: 400, text: async () => 'Bad request' })
    })
    await expect(
      addContactToList({ listKey: 'list-key-1', email: 'user@example.com' })
    ).resolves.not.toThrow()
  })
})
