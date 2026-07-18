import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The authoritative Basic/Premium signal for a report: the reportType selected
 * at checkout, persisted on the payments row that succeeded for it. price_paid
 * is not reliable for this — it's the real charged total (tax-inclusive, and
 * drifts whenever pricing changes), not a stable per-tier constant.
 */
export async function getPaidReportType(
  supabase: SupabaseClient,
  reportId: string
): Promise<'BASIC' | 'PREMIUM' | null> {
  const { data } = await supabase
    .from('payments')
    .select('metadata')
    .eq('report_id', reportId)
    .eq('status', 'succeeded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reportType = (data as any)?.metadata?.reportType

  if (reportType === 'BASIC' || reportType === 'PREMIUM') {
    return reportType
  }
  return null
}
