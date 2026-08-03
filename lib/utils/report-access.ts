/**
 * Determines whether a user is allowed to view a report.
 *
 * Admins can view any report. Non-admins must be the report owner.
 */
export function canViewReport(
  userId: string,
  isAdmin: boolean,
  reportUserId: string | null
): boolean {
  if (isAdmin) return true
  if (!reportUserId) return false
  return userId === reportUserId
}

export type PaymentGateStatus = 'allowed' | 'pending_confirmation'

/**
 * Decides whether the payment gate on /reports/[id]/view should let the
 * request through or show a "pending confirmation" state.
 *
 * Never returns a value that implies redirecting elsewhere — the caller
 * must render a terminal state for 'pending_confirmation' rather than
 * bouncing to another route, to avoid recreating the redirect loop this
 * function replaces (see docs/superpowers/plans/2026-08-01-report-view-payment-gate-redirect-loop.md).
 */
export function getPaymentGateStatus(
  isTokenAccess: boolean,
  pricePaid: number | null,
  hasSucceededPayment: boolean
): PaymentGateStatus {
  if (isTokenAccess) return 'allowed'
  if (pricePaid != null && pricePaid > 0) return 'allowed'
  return hasSucceededPayment ? 'allowed' : 'pending_confirmation'
}
