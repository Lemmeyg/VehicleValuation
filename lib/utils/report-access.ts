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
