import { supabaseAdmin } from '@/lib/db/supabase'

/**
 * Best-effort match of a submission's email to an existing paid report.
 * Non-fatal by design: a miss (null) is expected for most submitters, and a
 * DB error here should never block the submission itself.
 */
export async function findMatchingReportId(email: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('reports')
      .select('id')
      .ilike('email', email)
      .gt('price_paid', 0)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null
    return (data as { id: string }).id
  } catch {
    return null
  }
}
