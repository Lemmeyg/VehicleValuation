import { supabaseAdmin } from '@/lib/db/supabase'
import { addContactToList } from '@/lib/zoho-campaigns'

export interface EnrollHeldReportBuyerOptions {
  /** The caller knows this report was paid for (the webhook pipeline), even if price_paid isn't written yet. */
  paid?: boolean
  /** Checkout email, used when the report row has none. */
  fallbackEmail?: string
}

/**
 * Enrols the buyer of a held report in the Zoho Campaigns "Report Held" list,
 * whose Workflow Automation sends the "we're checking your report" email
 * (docs/Inbox/report-delivery-prd.md §6.4, §11.2).
 *
 * Mirrors the Report Delivery enrolment in pdf-generator: awaited, guarded by
 * review_email_enrolled_at (stamped only after Zoho confirms, so a transient
 * failure doesn't permanently disable the send), and it never throws — a
 * Zoho problem must never change the outcome of the pipeline.
 *
 * The two-list design matters: a held buyer is never on Report Delivery until
 * release, so their first entry there still fires the ready email (§11.3).
 */
export async function enrollHeldReportBuyer(
  reportId: string,
  opts: EnrollHeldReportBuyerOptions = {}
): Promise<'enrolled' | 'skipped' | 'failed'> {
  try {
    const listKey = process.env.ZOHO_CAMPAIGNS_REPORT_HELD_LIST_KEY
    if (!listKey) {
      console.error(
        `[report-held-email] ZOHO_CAMPAIGNS_REPORT_HELD_LIST_KEY is not set — skipping Report Held enrolment for report ${reportId}`
      )
      return 'skipped'
    }

    const { data: report, error: fetchError } = await supabaseAdmin
      .from('reports')
      .select(
        'email, price_paid, paid_at, vehicle_year, vehicle_make, vehicle_model, autodev_vin_data, review_email_enrolled_at'
      )
      .eq('id', reportId)
      .single()

    if (fetchError || !report) {
      console.error(
        `[report-held-email] Could not read report ${reportId} for Report Held enrolment:`,
        fetchError
      )
      return 'failed'
    }

    if (report.review_email_enrolled_at) return 'skipped'

    const paid = opts.paid || (report.price_paid ?? 0) > 0 || !!report.paid_at
    if (!paid) return 'skipped'

    const email = report.email || opts.fallbackEmail
    if (!email) {
      console.error(`[report-held-email] Report ${reportId} has no email — cannot enrol`)
      return 'skipped'
    }

    const vin = (report.autodev_vin_data ?? {}) as {
      make?: string
      model?: string
      vehicle?: { year?: number | string }
    }
    const year = report.vehicle_year ?? vin.vehicle?.year

    const enrolled = await addContactToList({
      listKey,
      email,
      customFields: {
        Year: year != null ? String(year) : '',
        Make: report.vehicle_make ?? vin.make ?? '',
        Model: report.vehicle_model ?? vin.model ?? '',
      },
    })
    if (!enrolled) {
      console.error(
        `[report-held-email] Zoho did not confirm Report Held enrolment for ${reportId}`
      )
      return 'failed'
    }

    const { error: stampError } = await supabaseAdmin
      .from('reports')
      .update({ review_email_enrolled_at: new Date().toISOString() })
      .eq('id', reportId)
    if (stampError) {
      console.error(
        `[report-held-email] Enrolled report ${reportId} but failed to write review_email_enrolled_at:`,
        stampError
      )
    }
    return 'enrolled'
  } catch (err) {
    console.error(`[report-held-email] Report Held enrolment error for report ${reportId}:`, err)
    return 'failed'
  }
}
