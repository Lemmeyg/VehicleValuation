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

// Fire-and-forget: adds a contact to a Zoho Campaigns list. The list itself
// drives delivery via a Workflow Automation configured in the Zoho Campaigns
// console — this function's only job is enrollment, never throws.
export async function addContactToList(params: AddContactToListParams): Promise<boolean> {
  try {
    const accessToken = await getAccessToken()
    if (!accessToken) return false

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
      console.error('[zoho-campaigns] add contact failed:', response.status, errorBody)
      return false
    }

    return true
  } catch (err) {
    console.error('[zoho-campaigns] add contact error:', err)
    return false
  }
}
