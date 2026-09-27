import { isHeldStatus } from '@/lib/constants/report-status'

export type ReportDisplayState = 'progress' | 'held' | 'ready' | 'refunded'

export interface ReportDisplayInputs {
  status: string
  pdfDownloadToken: string | null
}

/**
 * The single source of truth for which screen a report shows.
 * /view, /print, and /action-plan all call this so they can never disagree
 * about a report's readiness (docs/Inbox/report-delivery-prd.md §9.2).
 */
export function computeReportDisplayState(inputs: ReportDisplayInputs): ReportDisplayState {
  if (inputs.status === 'refunded') return 'refunded'
  if (isHeldStatus(inputs.status)) return 'held'
  if (inputs.status === 'completed' && inputs.pdfDownloadToken) return 'ready'
  return 'progress'
}
