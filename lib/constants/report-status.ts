/**
 * Every status a PAID report can end up in where the pipeline stopped short
 * of releasing it — the customer sees the held screen, not their report
 * (docs/Inbox/report-delivery-prd.md §5.1). Defined once per the PRD's own
 * instruction; every place that used to special-case vin_decode_failed/
 * valuation_failed individually should read this instead.
 */
export const HELD_STATUSES = [
  'needs_review',
  'vin_decode_failed',
  'valuation_failed',
  'failed',
] as const

export type HeldStatus = (typeof HELD_STATUSES)[number]

export function isHeldStatus(status: string | null | undefined): status is HeldStatus {
  return !!status && (HELD_STATUSES as readonly string[]).includes(status)
}
