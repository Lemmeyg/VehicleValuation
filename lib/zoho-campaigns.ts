async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.ZOHO_CAMPAIGNS_CLIENT_ID
  const clientSecret = process.env.ZOHO_CAMPAIGNS_CLIENT_SECRET
  const refreshToken = process.env.ZOHO_CAMPAIGNS_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) return null

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  })

  const response = await fetch(`https://accounts.zoho.com/oauth/v2/token?${params.toString()}`, {
    method: 'POST',
    signal: AbortSignal.timeout(3000),
  })
  if (!response.ok) return null

  const data = (await response.json()) as { access_token?: string }
  return data.access_token ?? null
}

export interface AddContactToListParams {
  listKey: string
  email: string
  customFields?: Record<string, string>
}

// listsubscribe (contactinfo-based) is the only endpoint that supports custom
// fields. Confirmed 2026-07-17: it requires OAuth scope
// ZohoCampaigns.contact.UPDATE specifically (not CREATE) — the production
// refresh token was only ever granted CREATE, which is why every previous
// attempt returned a raw session/login error page. Also handles create for
// new contacts on its own, so no separate create step is needed before
// calling this. Kept only for the customFields case; do not route the
// no-custom-field path through it, since callAddListSubscribersInBulk needs
// only CREATE scope.
async function callListSubscribe(
  accessToken: string,
  params: AddContactToListParams
): Promise<boolean> {
  const contactInfo = JSON.stringify({
    'Contact Email': params.email,
    ...params.customFields,
  })

  const query = new URLSearchParams({
    resfmt: 'JSON',
    listkey: params.listKey,
    contactinfo: contactInfo,
  })

  const response = await fetch(
    `https://campaigns.zoho.com/api/v1.1/json/listsubscribe?${query.toString()}`,
    {
      method: 'POST',
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      signal: AbortSignal.timeout(3000),
    }
  )

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('[zoho-campaigns] listsubscribe failed:', response.status, errorBody)
    return false
  }

  // listsubscribe returns HTTP 200 even on failure (e.g. an invalid/empty
  // listkey) — the real result is in the JSON body, not the status code.
  const data = (await response.json()) as { status?: string; code?: string; message?: string }
  if (data.status !== 'success') {
    console.error('[zoho-campaigns] listsubscribe did not enroll contact:', data)
    return false
  }

  return true
}

// Alternative to listsubscribe for the no-custom-field case. Only needs
// ZohoCampaigns.contact.CREATE scope (vs. listsubscribe's UPDATE) and doesn't
// support custom fields (emailids only), so it can't cover a personalized
// list — used by the dispute-letter route, which needs no custom fields.
async function callAddListSubscribersInBulk(
  accessToken: string,
  params: AddContactToListParams
): Promise<boolean> {
  const query = new URLSearchParams({
    resfmt: 'JSON',
    listkey: params.listKey,
    emailids: params.email,
  })

  const response = await fetch(
    `https://campaigns.zoho.com/api/v1.1/addlistsubscribersinbulk?${query.toString()}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      signal: AbortSignal.timeout(3000),
    }
  )

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('[zoho-campaigns] addlistsubscribersinbulk failed:', response.status, errorBody)
    return false
  }

  const data = (await response.json()) as {
    status?: string
    ignored_contacts?: string[]
  }

  if (data.status !== 'success' || data.ignored_contacts?.includes(params.email)) {
    console.error('[zoho-campaigns] addlistsubscribersinbulk did not enroll contact:', data)
    return false
  }

  return true
}

// Fire-and-forget: adds a contact to a Zoho Campaigns list. The list itself
// drives delivery via a Workflow Automation configured in the Zoho Campaigns
// console — this function's only job is enrollment, never throws.
export async function addContactToList(params: AddContactToListParams): Promise<boolean> {
  try {
    const accessToken = await getAccessToken()
    if (!accessToken) return false

    if (params.customFields) {
      return await callListSubscribe(accessToken, params)
    }
    return await callAddListSubscribersInBulk(accessToken, params)
  } catch (err) {
    console.error('[zoho-campaigns] add contact error:', err)
    return false
  }
}
