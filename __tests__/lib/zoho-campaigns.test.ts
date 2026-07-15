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
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => '{"status":"success","ignored_contacts":[]}',
        json: async () => ({ status: 'success', ignored_contacts: [] }),
      })
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
    const result = await addContactToList({ listKey: 'list-key-1', email: 'user@example.com' })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://accounts.zoho.com/oauth/v2/token'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(result).toBe(true)
  })

  it('posts to the addlistsubscribersinbulk endpoint when no custom fields are given', async () => {
    const result = await addContactToList({ listKey: 'list-key-1', email: 'user@example.com' })

    const calls = (global.fetch as jest.Mock).mock.calls
    const bulkCall = calls.find(c => c[0].toString().includes('addlistsubscribersinbulk'))
    expect(bulkCall).toBeDefined()
    expect(bulkCall[0]).toContain('listkey=list-key-1')
    expect(bulkCall[0]).toContain('emailids=user%40example.com')
    expect(bulkCall[1].headers.Authorization).toBe('Zoho-oauthtoken test-access-token')
    expect(result).toBe(true)
  })

  it('returns false when addlistsubscribersinbulk responds success but ignores the contact', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.toString().includes('accounts.zoho.com')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'test-access-token' }),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => '{"status":"success","ignored_contacts":["user@example.com"]}',
        json: async () => ({ status: 'success', ignored_contacts: ['user@example.com'] }),
      })
    })

    const result = await addContactToList({ listKey: 'list-key-1', email: 'user@example.com' })
    expect(result).toBe(false)
  })

  it('returns false when addlistsubscribersinbulk responds 200 with a non-success status', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.toString().includes('accounts.zoho.com')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'test-access-token' }),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => '{"status":"error"}',
        json: async () => ({ status: 'error' }),
      })
    })

    const result = await addContactToList({ listKey: 'list-key-1', email: 'user@example.com' })
    expect(result).toBe(false)
  })

  it('posts to the listsubscribe endpoint (with contactinfo) when custom fields are given', async () => {
    const result = await addContactToList({
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
    expect(result).toBe(true)
  })

  it('does not call fetch when ZOHO_CAMPAIGNS_CLIENT_ID is missing', async () => {
    delete process.env.ZOHO_CAMPAIGNS_CLIENT_ID
    const result = await addContactToList({ listKey: 'list-key-1', email: 'user@example.com' })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })

  it('does not call the downstream endpoint when the token refresh response has no access_token', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
    const result = await addContactToList({ listKey: 'list-key-1', email: 'user@example.com' })
    expect(global.fetch).toHaveBeenCalledTimes(1) // only the token refresh, no downstream call
    expect(result).toBe(false)
  })

  it('does not call the downstream endpoint when the token refresh response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    })
    const result = await addContactToList({ listKey: 'list-key-1', email: 'user@example.com' })
    expect(global.fetch).toHaveBeenCalledTimes(1) // only the token refresh, no downstream call
    expect(result).toBe(false)
  })

  it('resolves without throwing when the token refresh fetch rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'))
    const resultPromise = addContactToList({ listKey: 'list-key-1', email: 'user@example.com' })
    await expect(resultPromise).resolves.not.toThrow()
    expect(await resultPromise).toBe(false)
  })

  it('resolves without throwing when a fetch call is aborted (timeout)', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))
    const resultPromise = addContactToList({ listKey: 'list-key-1', email: 'user@example.com' })
    await expect(resultPromise).resolves.not.toThrow()
    expect(await resultPromise).toBe(false)
  })

  it('resolves without throwing when addlistsubscribersinbulk returns a non-ok response', async () => {
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
    const resultPromise = addContactToList({ listKey: 'list-key-1', email: 'user@example.com' })
    await expect(resultPromise).resolves.not.toThrow()
    expect(await resultPromise).toBe(false)
  })
})
