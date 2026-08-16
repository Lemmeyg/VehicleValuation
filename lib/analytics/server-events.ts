/**
 * Server-Side Analytics Events
 *
 * Companion to lib/analytics/events.ts, which only works in the browser.
 *
 * Some things worth measuring never involve our client-side code at all. The
 * report-delivery email links straight to /api/reports/download/[token]: the
 * browser asks our server for a file and gets bytes back. No page loads, no
 * posthog-js, no way for the normal tracking to see it. This module captures
 * those events from the server instead (BL-125).
 *
 * Everything here is best-effort. Analytics must never break a paying
 * customer's download, so failures are swallowed and logged.
 */

import { PostHog } from 'posthog-node'
import type { ReportDownloadSource } from './events'

/**
 * User agents that fetch links without a human involved — mail security
 * scanners, link unfurlers, crawlers, scripts. Corporate mail gateways in
 * particular open links to check them for malware, and counting those as
 * customer downloads would quietly inflate the funnel's final stage.
 */
const BOT_USER_AGENT_PATTERN =
  /bot|crawler|spider|slurp|curl|wget|python-requests|okhttp|headless|preview|scanner|fetcher|monitoring|office existence discovery|proofpoint|mimecast|barracuda/i

export function isLikelyBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return BOT_USER_AGENT_PATTERN.test(userAgent)
}

function createClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return null

  return new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    // Route handlers are short-lived — send immediately rather than batching
    // into a background flush that may never run.
    flushAt: 1,
    flushInterval: 0,
  })
}

interface ReportDownloadedParams {
  reportId: string
  /**
   * The buyer's PostHog id, stored on the report at creation. Null when the
   * report predates that column, was made by an admin tool, or the visitor
   * had analytics blocked.
   */
  distinctId: string | null
  source?: ReportDownloadSource
}

/**
 * Record that a report PDF was actually delivered to a customer.
 *
 * With a stored distinctId the event lands on the same PostHog person who
 * visited pricing and checked out, so the checkout -> download funnel works
 * without any special configuration. Without one it still counts, under a
 * report-scoped id and flagged `attributed: false` so the two cases can be
 * told apart rather than silently blurred.
 */
export async function captureReportDownloaded({
  reportId,
  distinctId,
  source = 'email_link',
}: ReportDownloadedParams): Promise<void> {
  const client = createClient()
  if (!client) return

  try {
    client.capture({
      distinctId: distinctId ?? `report:${reportId}`,
      event: 'report_downloaded',
      properties: {
        format: 'pdf',
        source,
        reportId,
        attributed: distinctId != null,
        timestamp: new Date().toISOString(),
      },
    })

    await client.shutdown()
  } catch (err) {
    console.error('[server-events] report_downloaded capture failed', err)
  }
}
