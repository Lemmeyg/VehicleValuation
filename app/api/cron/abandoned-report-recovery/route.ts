import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'
import { addContactToList } from '@/lib/zoho-campaigns'
import { resolveStateCodeFromZip } from '@/lib/personalization/zip-to-state'
import { resolveStateArticle } from '@/lib/personalization/state-article'
import { resolveVehicleGuideSlug } from '@/lib/personalization/vehicle-year-article'
import { buildKbArticleUrl } from '@/lib/personalization/kb-article-url'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MIN_AGE_MS = 2 * 60 * 60 * 1000 // 2 hours — give checkout a real chance to complete
const MAX_AGE_MS = 26 * 60 * 60 * 1000 // 26 hours — cap the query, never re-scan very old rows

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.CRON_SECRET

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const listKey = process.env.ZOHO_CAMPAIGNS_ABANDONED_REPORT_LIST_KEY
  if (!listKey) {
    console.error('[abandoned-report-recovery] ZOHO_CAMPAIGNS_ABANDONED_REPORT_LIST_KEY not set')
    return NextResponse.json({ ok: true, enrolled: 0 })
  }

  const now = Date.now()
  const { data: reports, error } = await supabaseAdmin
    .from('reports')
    .select(
      'id, email, vehicle_year, vehicle_make, vehicle_model, zip_code, state_article_url, state_name, vehicle_guide_url'
    )
    .is('abandoned_recovery_sent_at', null)
    .is('price_paid', null)
    .not('email', 'is', null)
    .lte('created_at', new Date(now - MIN_AGE_MS).toISOString())
    .gte('created_at', new Date(now - MAX_AGE_MS).toISOString())

  if (error) {
    console.error('[abandoned-report-recovery] query error:', error)
    return NextResponse.json({ error: 'DB query failed' }, { status: 500 })
  }

  let enrolled = 0

  for (const report of reports ?? []) {
    if (!report.email) continue

    // Combine into one phrase so the email's single %%Model%% merge tag always
    // reads naturally, even when VIN decode failed for this report (Year/Make
    // still get sent separately, raw, for potential future Zoho segmentation).
    const vehicleDescription =
      report.vehicle_year && report.vehicle_make && report.vehicle_model
        ? `${report.vehicle_year} ${report.vehicle_make} ${report.vehicle_model}`
        : 'your vehicle'

    try {
      // Reports created after the personalization feature shipped already
      // have these computed at submission time — reuse them instead of
      // recomputing. Only reports that predate that change (state_article_url
      // still null) need computing here, as a fallback.
      let stateArticleUrl = report.state_article_url
      let stateName = report.state_name
      let vehicleGuideUrl = report.vehicle_guide_url

      if (!stateArticleUrl || !stateName) {
        const stateCode = resolveStateCodeFromZip(report.zip_code)
        const resolved = resolveStateArticle(stateCode)
        stateName = resolved.stateName
        stateArticleUrl = buildKbArticleUrl(resolved.slug, 'state_article')
      }

      if (!vehicleGuideUrl) {
        const vehicleGuideSlug = resolveVehicleGuideSlug(report.vehicle_year)
        vehicleGuideUrl = buildKbArticleUrl(vehicleGuideSlug, 'vehicle_guide')
      }

      const success = await addContactToList({
        listKey,
        email: report.email,
        customFields: {
          Year: report.vehicle_year?.toString() ?? '',
          Make: report.vehicle_make ?? '',
          Model: vehicleDescription,
          ReportId: report.id,
          StateArticleURL: stateArticleUrl,
          StateName: stateName,
          VehicleGuideURL: vehicleGuideUrl,
        },
      })
      if (!success) continue

      const { error: updateError } = await supabaseAdmin
        .from('reports')
        .update({
          abandoned_recovery_sent_at: new Date().toISOString(),
          state_article_url: stateArticleUrl,
          state_name: stateName,
          vehicle_guide_url: vehicleGuideUrl,
        })
        .eq('id', report.id)
      if (updateError) {
        console.error(
          `[abandoned-report-recovery] failed to flag report ${report.id}:`,
          updateError
        )
      } else {
        enrolled++
      }
    } catch (err) {
      console.error(`[abandoned-report-recovery] failed for report ${report.id}:`, err)
    }
  }

  return NextResponse.json({ ok: true, enrolled })
}
