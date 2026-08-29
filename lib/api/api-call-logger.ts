import { supabaseAdmin } from '@/lib/db/supabase'

interface LogApiCallParams {
  reportId?: string
  provider: 'autodev' | 'marketcheck' | 'webhook' | 'internal'
  endpoint: string
  success: boolean
  responseTimeMs?: number
  cost?: number
  requestData?: Record<string, unknown>
  responseData?: Record<string, unknown>
  errorMessage?: string
}

export async function logApiCall(params: LogApiCallParams): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('api_call_logs').insert({
      report_id: params.reportId ?? 'unset',
      api_provider: params.provider,
      endpoint: params.endpoint,
      success: params.success,
      response_time_ms: params.responseTimeMs ?? 0,
      cost: params.cost ?? 0,
      request_data: params.requestData ?? null,
      response_data: params.responseData ?? null,
      error_message: params.errorMessage ?? null,
    })
    if (error) {
      console.error('[logApiCall] Failed to insert api_call_logs:', error)
    }
  } catch (err) {
    console.error('[logApiCall] Unexpected error:', err)
  }
}

export interface LogSupplementOutcomeParams {
  /** Which supplementer produced this record. */
  fn: 'supplementComparables' | 'supplementWithAlternateDealerType'
  reportId?: string
  /** Machine-readable reason the supplement pass exited the way it did. */
  exitReason: string
  /** validCount / validatedCount as passed into the supplementer. */
  validCountIn: number
  /** Listing count in the prediction handed back to the caller. */
  listingsOut: number
  supplemented: boolean
}

/**
 * Durable, structured record of why a comparables-supplement pass exited the way it did.
 * Written as an `api_call_logs` row (`api_provider: 'internal'`, `endpoint: 'supplement:outcome'`)
 * so "why were there no comps for this report" is answerable from the database after the fact
 * instead of only from long-gone runtime logs.
 *
 * Fire-and-forget: delegates to `logApiCall`, which swallows every DB error and never throws.
 */
export async function logSupplementOutcome(params: LogSupplementOutcomeParams): Promise<void> {
  await logApiCall({
    reportId: params.reportId,
    provider: 'internal',
    endpoint: 'supplement:outcome',
    success: params.supplemented,
    responseTimeMs: 0,
    cost: 0,
    responseData: {
      fn: params.fn,
      exitReason: params.exitReason,
      validCountIn: params.validCountIn,
      listingsOut: params.listingsOut,
      supplemented: params.supplemented,
    },
  })
}
