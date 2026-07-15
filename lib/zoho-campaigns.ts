async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.ZOHO_CAMPAIGNS_CLIENT_ID
  const clientSecret = process.env.ZOHO_CAMPAIGNS_CLIENT_SECRET
  const refreshToken = process.env.ZOHO_CAMPAIGNS_REFRESH_TOKEN
  // TEMPORARY diagnostic (2026-07-15) — no secret values logged, presence/prefix only.
  console.log('[zoho-campaigns] getAccessToken env check:', {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasRefreshToken: !!refreshToken,
    clientIdPrefix: clientId?.slice(0, 10),
  })
  if (!clientId || !clientSecret || !refreshToken) {
    console.error('[zoho-campaigns] getAccessToken: missing required env var(s)')
    return null
  }

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
  if (!response.ok) {
    console.error('[zoho-campaigns] getAccessToken: token endpoint returned', response.status)
    return null
  }

  const data = (await response.json()) as { access_token?: string; error?: string }
  console.log('[zoho-campaigns] getAccessToken result:', {
    gotAccessToken: !!data.access_token,
    tokenPrefix: data.access_token?.slice(0, 10),
    error: data.error,
  })
  return data.access_token ?? null
}

export interface AddContactToListParams {
  listKey: string
  email: string
  customFields?: Record<string, string>
}

// listsubscribe (contactinfo-based) is the only endpoint that supports custom
// fields like VIN, needed for the abandoned-report-recovery list's %%VIN%%
// merge tag. It's been broken account-wide since at least 2026-07-13 —
// confirmed with Zoho support 2026-07-15 (ticket filed) — returning a raw
// session/login error page instead of a real API response, on every request
// shape and HTTP method tried. Kept only for the customFields case; do not
// route the no-custom-field path through it.
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

  return true
}

// Working alternative to listsubscribe for the no-custom-field case. Doesn't
// support custom fields (emailids only) so can't cover the VIN-personalized
// list, but confirmed working 2026-07-15 for plain enrollment.
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

  console.log('[zoho-campaigns] addlistsubscribersinbulk response:', data)

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
