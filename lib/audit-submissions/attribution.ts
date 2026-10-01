/**
 * Channel + page-version tagging for /comps-check (workstream 7 loop harness).
 *
 * Every link that points at /comps-check carries `utm_campaign` naming the channel
 * (e.g. comps_check_outreach, comps_check_report_ready, comps_check_drip_e3,
 * comps_check_action_plan) and `utm_content` naming the email/link version. The page
 * itself carries a `page_variant` (the copy-slot payload version). All three ride on
 * every audit_* event and on the stored submission, so each experiment can be read
 * per channel and per page version.
 */

export interface AuditAttribution {
  source: string
  utmContent: string | null
  pageVariant: string
}

export const DIRECT_SOURCE = 'direct'

// Tags are written by us into links; anything else is junk or tampering. Keep them
// short and boring so they can't break queries or bloat a row.
const TAG_PATTERN = /^[a-z0-9_.-]{1,64}$/i

export function sanitizeTag(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return TAG_PATTERN.test(trimmed) ? trimmed : null
}

export function readAttribution(search: string, pageVariant: string): AuditAttribution {
  const params = new URLSearchParams(search)
  return {
    source: sanitizeTag(params.get('utm_campaign')) ?? DIRECT_SOURCE,
    utmContent: sanitizeTag(params.get('utm_content')),
    pageVariant: sanitizeTag(pageVariant) ?? 'default',
  }
}
