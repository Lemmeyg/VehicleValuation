import { PostHog } from 'posthog-node'
import { z } from 'zod'

/**
 * "Copy slots" for /comps-check (workstream 7 loop harness).
 *
 * The headline, sub-headline, submit-button label and an optional trust line come
 * from the payload of the PostHog feature flag below, so an approved wording change
 * goes live without a deploy. The payload's `version` becomes the page_variant tag on
 * every audit_* event, which is how each wording is measured.
 *
 * Any problem — no key, PostHog slow or down, flag missing/disabled, payload malformed
 * — falls back to DEFAULT_COMPS_CHECK_COPY. The page must never break because of this.
 */

export const COMPS_CHECK_COPY_FLAG = 'comps-check-copy'

// The flag is a 100%-rollout boolean, so a fixed id evaluates it for everyone.
const EVALUATION_DISTINCT_ID = 'comps-check-page'
const REQUEST_TIMEOUT_MS = 1500

const copySchema = z.object({
  version: z.string().regex(/^[a-z0-9_.-]{1,40}$/i),
  headline: z.string().trim().min(5).max(120),
  subheadline: z.string().trim().min(10).max(400),
  submitLabel: z.string().trim().min(2).max(40),
  trustLine: z.string().trim().min(5).max(200).nullable().optional(),
})

export type CompsCheckCopy = {
  version: string
  headline: string
  subheadline: string
  submitLabel: string
  trustLine: string | null
}

export const DEFAULT_COMPS_CHECK_COPY: CompsCheckCopy = {
  version: 'default',
  headline: "Let us double-check your insurer's numbers",
  subheadline:
    "Upload the comps list or valuation report your insurance company sent you and we'll personally check it for pricing adjustments that courts have already ruled against in similar cases.",
  submitLabel: 'Submit for review',
  trustLine: null,
}

export function parseCopyPayload(payload: unknown): CompsCheckCopy {
  let value = payload
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return DEFAULT_COMPS_CHECK_COPY
    }
  }
  const parsed = copySchema.safeParse(value)
  if (!parsed.success) return DEFAULT_COMPS_CHECK_COPY
  return { ...parsed.data, trustLine: parsed.data.trustLine ?? null }
}

export async function getCompsCheckCopy(): Promise<CompsCheckCopy> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return DEFAULT_COMPS_CHECK_COPY

  const client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
    featureFlagsRequestTimeoutMs: REQUEST_TIMEOUT_MS,
  })

  try {
    const flags = await client.evaluateFlags(EVALUATION_DISTINCT_ID, {
      flagKeys: [COMPS_CHECK_COPY_FLAG],
    })
    return parseCopyPayload(flags.getFlagPayload(COMPS_CHECK_COPY_FLAG))
  } catch (err) {
    console.error('[comps-check] copy flag fetch failed, using default copy', err)
    return DEFAULT_COMPS_CHECK_COPY
  } finally {
    await client.shutdown().catch(() => {})
  }
}
