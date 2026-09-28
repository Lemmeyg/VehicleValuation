import { isHeldStatus } from '@/lib/constants/report-status'

export type ReportDisplayState = 'progress' | 'held' | 'ready' | 'refunded'

export interface ReportDisplayInputs {
  status: string
  pdfDownloadToken: string | null
  /**
   * Reports completed before the pdf_download_token column existed
   * (migration 20260722010000) have a real, stored PDF but no token —
   * pdf_storage_path is proof the file exists and must also count as
   * "ready," or every one of those reports shows as stuck "held" forever.
   */
  pdfStoragePath?: string | null
}

/**
 * The single source of truth for which screen a report shows.
 * /view, /print, and /action-plan all call this so they can never disagree
 * about a report's readiness (docs/Inbox/report-delivery-prd.md §9.2).
 */
export function computeReportDisplayState(inputs: ReportDisplayInputs): ReportDisplayState {
  if (inputs.status === 'refunded') return 'refunded'
  if (isHeldStatus(inputs.status)) return 'held'
  if (inputs.status === 'completed' && (inputs.pdfDownloadToken || inputs.pdfStoragePath)) {
    return 'ready'
  }
  return 'progress'
}
