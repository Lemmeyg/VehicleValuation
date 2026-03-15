import { supabaseAdmin } from '@/lib/db/supabase'

interface LogApiCallParams {
  reportId: string
  provider: 'autodev' | 'marketcheck'
  endpoint: string
  success: boolean
  responseTimeMs: number
  cost: number
  requestData?: Record<string, unknown>
  responseData?: Record<string, unknown>
  errorMessage?: string
}

export async function logApiCall(params: LogApiCallParams): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('api_call_logs').insert({
      report_id: params.reportId,
      api_provider: params.provider,
      endpoint: params.endpoint,
      success: params.success,
      response_time_ms: params.responseTimeMs,
      cost: params.cost,
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
