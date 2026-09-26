import { supabaseAdmin } from '@/lib/db/supabase'
import { generateAndUploadPDF } from '@/lib/services/pdf-generator'
import { fetchMarketCheckData } from '@/lib/api/marketcheck-client'
import { fetchAutoDevVinDecode } from '@/lib/api/autodev-client'
import { logApiCall } from '@/lib/api/api-call-logger'
import { validateListingUrls } from '@/lib/utils/url-validator'
import { supplementComparables } from '@/lib/utils/comparables-supplementer'
import { supplementWithAlternateDealerType } from '@/lib/utils/dealer-type-supplementer'
import { gateListings } from '@/lib/utils/comp-gates'
import { makeScoreSortFn } from '@/lib/utils/comp-relevance-score'
import type { ValidationStats } from '@/lib/utils/url-validator'
import { QA_CHECKS, type QaCheckContext, type QaCheckResult } from '@/lib/services/qa-checks'

const PRIMARY_DEALER_TYPE = 'franchise' as const

export interface RunPipelinePaymentInfo {
  amount: number
  orderId: string
  customerEmail?: string
  resolvedUserId?: string | null
  rawUserId?: string | null
}

export interface RunPipelineOptions {
  payment?: RunPipelinePaymentInfo
  refetch?: boolean
}

type HeldStatus = 'vin_decode_failed' | 'valuation_failed' | 'needs_review'

function runCheck(key: string, ctx: QaCheckContext): QaCheckResult {
  const check = QA_CHECKS.find(c => c.key === key)
  if (!check) throw new Error(`No QA check registered for key ${key}`)
  return check.run(ctx)
}

async function writeProgressStep(
  reportId: string,
  step: 'comps' | 'listings' | 'valuation' | 'pdf'
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('reports')
    .update({ progress_step: step })
    .eq('id', reportId)
  if (error) {
    console.error(
      `[report-pipeline] Failed to write progress_step '${step}' for report ${reportId}:`,
      error
    )
  }
}

async function holdReport(
  reportId: string,
  status: HeldStatus,
  qaResults: QaCheckResult[]
): Promise<'held'> {
  const failedChecks = qaResults.filter(r => !r.passed).map(r => r.key)
  const { error } = await supabaseAdmin
    .from('reports')
    .update({
      status,
      qa_results: qaResults,
      qa_failed_checks: failedChecks,
      qa_evaluated_at: new Date().toISOString(),
    })
    .eq('id', reportId)
  if (error) {
    console.error(`[report-pipeline] Failed to write hold status for report ${reportId}:`, error)
  }
  return 'held'
}

async function releaseReport(reportId: string): Promise<'completed'> {
  const { error } = await supabaseAdmin
    .from('reports')
    .update({
      access_token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', reportId)
  if (error) {
    console.error(
      `[report-pipeline] Failed to extend access token on release for report ${reportId}:`,
      error
    )
  }
  return 'completed'
}

/**
 * Runs every post-payment step for a report: VIN decode, MarketCheck valuation,
 * comp URL validation/supplement, and PDF generation. Called from the LemonSqueezy
 * webhook's after() step (payment supplied); a future admin re-run and daily sweep
 * will call it without payment (docs/Inbox/report-delivery-prd.md §6.1).
 */
export async function runReportPipeline(
  reportId: string,
  opts: RunPipelineOptions = {}
): Promise<'completed' | 'held'> {
  const { payment } = opts
  const supabase = supabaseAdmin

  try {
    const { data: report, error: fetchError } = await supabase
      .from('reports')
      .select(
        'vin, mileage, zip_code, vehicle_data, marketcheck_valuation, autodev_vin_data, "GL Notes"'
      )
      .eq('id', reportId)
      .single()

    if (fetchError || !report) {
      console.error('[WH-6] Error fetching report for API calls:', fetchError)
      await logApiCall({
        reportId,
        provider: 'webhook',
        endpoint: '[WH-6] report fetch',
        success: false,
        errorMessage: fetchError?.message ?? 'report not found',
        requestData: { reportId },
      })
      return holdReport(reportId, 'needs_review', [
        {
          key: 'pipeline_error',
          label: 'Pipeline error',
          passed: false,
          detail: fetchError?.message ?? 'report not found',
        },
      ])
    }
    console.log(`[WH-6] Report fetched OK for report ${reportId}`)

    console.log(`[Webhook] Report ${reportId} fetched for API calls:`, {
      vin: report.vin?.substring(0, 8) + '...',
      mileage: report.mileage,
      zip_code: report.zip_code,
      hasExistingMarketCheck: !!report.marketcheck_valuation,
    })

    await writeProgressStep(reportId, 'comps')

    // ========================================
    // FETCH AUTO.DEV VIN DECODE DATA
    // ========================================
    let autodevVinData = report.autodev_vin_data ?? null
    let vinResult: { success: boolean; data?: typeof autodevVinData; error?: string } = {
      success: !!autodevVinData,
      data: autodevVinData ?? undefined,
    }

    if (!autodevVinData) {
      console.log(
        `[Webhook] No existing autodev_vin_data — fetching Auto.dev VIN decode for report ${reportId} (fallback)`
      )
      const vinStartTime = Date.now()
      vinResult = await fetchAutoDevVinDecode(report.vin)
      const vinResponseTime = Date.now() - vinStartTime

      if (vinResult.success && vinResult.data) {
        console.log(`[Webhook] Auto.dev VIN decode success for report ${reportId}:`, {
          make: vinResult.data.make,
          model: vinResult.data.model,
          year: vinResult.data.vehicle?.year,
          responseTimeMs: vinResponseTime,
        })
        autodevVinData = {
          ...vinResult.data,
          generatedAt: new Date().toISOString(),
        }
        await logApiCall({
          reportId,
          provider: 'autodev',
          endpoint: '/vin/{vin}',
          success: true,
          responseTimeMs: vinResponseTime,
          cost: 0.0,
          requestData: { vin: report.vin },
          responseData: {
            make: vinResult.data.make,
            model: vinResult.data.model,
            year: vinResult.data.vehicle?.year,
            vinValid: vinResult.data.vinValid,
          },
        })
      } else {
        console.warn(
          `[Webhook] Auto.dev VIN decode failed for report ${reportId}:`,
          vinResult.error
        )
        await logApiCall({
          reportId,
          provider: 'autodev',
          endpoint: '/vin/{vin}',
          success: false,
          responseTimeMs: vinResponseTime,
          cost: 0.0,
          requestData: { vin: report.vin },
          errorMessage: vinResult.error,
        })
      }
    } else {
      console.log(
        `[Webhook] autodev_vin_data already present for report ${reportId} — skipping re-fetch`
      )
    }

    const subjectVehicle =
      vinResult.success && vinResult.data
        ? {
            year: vinResult.data.vehicle?.year,
            make: vinResult.data.make,
            model: vinResult.data.model,
            trim: vinResult.data.trim,
          }
        : undefined

    // ========================================
    // FETCH MARKETCHECK DATA (if not already present)
    // ========================================
    let marketcheckData = report.marketcheck_valuation
    let webhookSupplemented = false
    let webhookFallbackUsed = false

    if (!marketcheckData) {
      console.log(`[Webhook] Fetching MarketCheck data for report ${reportId}`, {
        hasSubjectVehicle: !!subjectVehicle,
        subjectVehicle,
      })
      const mcStartTime = Date.now()
      const mcResult = await fetchMarketCheckData(
        report.vin,
        report.mileage,
        report.zip_code,
        false,
        undefined,
        subjectVehicle,
        PRIMARY_DEALER_TYPE
      )
      const mcResponseTime = Date.now() - mcStartTime

      if (mcResult.success && mcResult.data) {
        console.log(`[Webhook] MarketCheck success for report ${reportId}:`, {
          predictedPrice: mcResult.data.predictedPrice,
          totalComparables: mcResult.data.totalComparablesFound,
          fallbackUsed: mcResult.fallbackUsed,
          responseTimeMs: mcResponseTime,
        })
        webhookFallbackUsed = mcResult.fallbackUsed ?? false
        marketcheckData = mcResult.data
        await logApiCall({
          reportId,
          provider: 'marketcheck',
          endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
          success: true,
          responseTimeMs: mcResponseTime,
          cost: 0.09,
          requestData: {
            vin: report.vin,
            mileage: report.mileage,
            zip_code: report.zip_code,
            dealer_type: PRIMARY_DEALER_TYPE,
            fallback_used: mcResult.fallbackUsed ?? false,
          },
          responseData: {
            predicted_price: mcResult.data.predictedPrice,
            total_comparables_found: mcResult.data.totalComparablesFound,
            recent_comparables_found: mcResult.data.recentComparables?.num_found ?? 0,
          },
        })
      } else {
        console.error(`[Webhook] MarketCheck failed for report ${reportId}:`, mcResult.error)
        await logApiCall({
          reportId,
          provider: 'marketcheck',
          endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
          success: false,
          responseTimeMs: mcResponseTime,
          cost: 0.0,
          requestData: {
            vin: report.vin,
            mileage: report.mileage,
            zip_code: report.zip_code,
            dealer_type: PRIMARY_DEALER_TYPE,
          },
          errorMessage: mcResult.error,
        })
      }
    } else {
      console.log(
        `[Webhook] MarketCheck data already exists for report ${reportId}, skipping API call`
      )
    }

    await writeProgressStep(reportId, 'listings')

    // URL validation + supplement
    if (marketcheckData) {
      let validatedPrediction = marketcheckData
      let urlStats: ValidationStats = {
        checkedCount: 0,
        failedCount: 0,
        failedUrls: [],
        validatedUrls: [],
        batchesUsed: 0,
      }
      let urlValidationSucceeded = false

      try {
        const gatedListings = gateListings(
          marketcheckData.recentComparables?.listings ?? [],
          marketcheckData.predictedPrice
        )
        const urlResult = await validateListingUrls(
          {
            ...marketcheckData,
            recentComparables: {
              ...marketcheckData.recentComparables,
              listings: gatedListings,
              num_found: gatedListings.length,
            },
          },
          {
            sortFn: makeScoreSortFn(
              {
                year: subjectVehicle?.year ?? 0,
                mileage: report.mileage ?? 0,
                zip: report.zip_code ?? null,
                model: subjectVehicle?.model,
                trim: subjectVehicle?.trim,
              },
              marketcheckData.predictedPrice
            ),
          }
        )
        validatedPrediction = urlResult.prediction
        urlStats = urlResult.stats
        urlValidationSucceeded = true
      } catch (err) {
        console.error(
          '[Webhook] validateListingUrls threw — proceeding with unvalidated listings:',
          err
        )
      }

      if (urlValidationSucceeded) {
        try {
          const dealerTypeResult = await supplementWithAlternateDealerType(
            validatedPrediction,
            urlStats.validatedUrls.length,
            report.vin,
            report.mileage,
            report.zip_code,
            PRIMARY_DEALER_TYPE,
            subjectVehicle,
            false,
            reportId
          )
          if (dealerTypeResult.supplemented) {
            await logApiCall({
              reportId,
              provider: 'marketcheck',
              endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
              success: true,
              responseTimeMs: 0,
              cost: 0.09,
              requestData: {
                vin: report.vin,
                mileage: report.mileage,
                zip_code: report.zip_code,
                dealer_type: dealerTypeResult.prediction.requestParams.dealer_type,
              },
              responseData: {
                predicted_price: dealerTypeResult.prediction.predictedPrice,
                total_comparables_found: dealerTypeResult.prediction.totalComparablesFound,
                recent_comparables_found:
                  dealerTypeResult.prediction.recentComparables?.num_found ?? 0,
              },
            })
          }
          urlStats = {
            ...urlStats,
            validatedUrls: [...urlStats.validatedUrls, ...dealerTypeResult.additionalValidatedUrls],
            failedUrls: [...urlStats.failedUrls, ...dealerTypeResult.additionalFailedUrls],
            failedCount: urlStats.failedCount + dealerTypeResult.additionalFailedCount,
          }

          const supplementResult = await supplementComparables(
            dealerTypeResult.prediction,
            urlStats.validatedUrls.length,
            subjectVehicle,
            report.vin,
            report.mileage ?? null,
            report.zip_code ?? null,
            marketcheckData.predictedPrice,
            reportId
          )
          validatedPrediction = supplementResult.prediction
          webhookSupplemented = supplementResult.supplemented
        } catch (err) {
          console.error('[Webhook] supplementComparables threw:', err)
        }
      }

      marketcheckData = validatedPrediction
    }

    await writeProgressStep(reportId, 'valuation')

    // ========================================
    // UPDATE REPORT WITH API DATA AND PAYMENT INFO
    // ========================================
    const updateData: Record<string, unknown> = {
      status: 'pending',
    }

    if (payment) {
      updateData.price_paid = payment.amount
      updateData.stripe_payment_id = payment.orderId
      if (!payment.rawUserId && payment.resolvedUserId) {
        updateData.user_id = payment.resolvedUserId
        updateData.email = payment.customerEmail
      }
    }

    if (marketcheckData) {
      if ((marketcheckData.recentComparables?.listings?.length ?? 0) === 0) {
        marketcheckData = { ...marketcheckData, compsEmpty: true }
        const statisticalN =
          marketcheckData.totalComparablesFound ?? marketcheckData.recentComparables?.num_found ?? 0
        const existingNote = report['GL Notes'] ? `${report['GL Notes']}\n` : ''
        updateData['GL Notes'] =
          `${existingNote}[auto] Empty comparables table — manual review; valuation from ` +
          `N=${statisticalN} statistical comps, ${new Date().toISOString().slice(0, 10)}`
      }

      updateData.marketcheck_valuation = marketcheckData
      updateData.marketcheck_predicted_price = marketcheckData.predictedPrice
      updateData.marketcheck_msrp = marketcheckData.msrp || null
      updateData.marketcheck_price_range_min = marketcheckData.priceRange?.min || null
      updateData.marketcheck_price_range_max = marketcheckData.priceRange?.max || null
      updateData.marketcheck_confidence = marketcheckData.confidence
      updateData.marketcheck_total_comparables_found = marketcheckData.totalComparablesFound
      updateData.marketcheck_recent_comparables_found =
        marketcheckData.recentComparables?.num_found || 0
      updateData.comparables_supplemented = webhookSupplemented
      updateData.marketcheck_fallback_used = webhookFallbackUsed
      updateData.valuation_result = {
        predictedPrice: marketcheckData.predictedPrice,
        lowValue:
          marketcheckData.priceRange?.min || Math.round(marketcheckData.predictedPrice * 0.9),
        averageValue: marketcheckData.predictedPrice,
        highValue:
          marketcheckData.priceRange?.max || Math.round(marketcheckData.predictedPrice * 1.1),
        confidence: marketcheckData.confidence,
        dataPoints: marketcheckData.totalComparablesFound,
        dataSource: 'marketcheck',
      }
    }

    if (autodevVinData) {
      updateData.autodev_vin_data = autodevVinData
    }

    const { error: reportError } = await supabase
      .from('reports')
      .update(updateData)
      .eq('id', reportId)

    if (reportError) {
      console.error('[Webhook] Error updating report:', reportError)
      return holdReport(reportId, 'needs_review', [
        {
          key: 'pipeline_error',
          label: 'Pipeline error',
          passed: false,
          detail: reportError.message,
        },
      ])
    }

    console.log(`[Webhook] Report ${reportId} updated with payment info and API data`)

    const qaSubject = {
      year: subjectVehicle?.year ?? report.vehicle_data?.year ?? 0,
      mileage: report.mileage ?? 0,
      zip: report.zip_code ?? null,
      model: subjectVehicle?.model,
      trim: subjectVehicle?.trim,
    }

    const vehicleIdentifiedResult = runCheck('vehicle_identified', {
      autodevVinData,
      vehicleDataYear: report.vehicle_data?.year,
      marketcheckData: null,
      subject: qaSubject,
    })
    if (!vehicleIdentifiedResult.passed) {
      console.warn(`[Webhook] VIN decode failed for report ${reportId} — holding for manual review`)
      console.log(`[Webhook] Report ${reportId} set to vin_decode_failed, skipping PDF`)
      return holdReport(reportId, 'vin_decode_failed', [vehicleIdentifiedResult])
    }

    if (!marketcheckData) {
      console.warn(
        `[Webhook] No MarketCheck valuation for report ${reportId} after all fallbacks — holding for manual review`
      )
      console.log(`[Webhook] Report ${reportId} set to valuation_failed, skipping PDF`)
      return holdReport(reportId, 'valuation_failed', [vehicleIdentifiedResult])
    }

    const qaContext: QaCheckContext = {
      autodevVinData,
      vehicleDataYear: report.vehicle_data?.year,
      marketcheckData,
      subject: qaSubject,
    }
    const valuationCompleteResult = runCheck('valuation_complete', qaContext)
    const tenCompsResult = runCheck('ten_comps_displayed', qaContext)

    if (!valuationCompleteResult.passed || !tenCompsResult.passed) {
      console.warn(`[Webhook] QA check failed pre-PDF for report ${reportId}`, {
        valuationComplete: valuationCompleteResult.passed,
        tenCompsDisplayed: tenCompsResult.passed,
      })
      return holdReport(reportId, 'needs_review', [
        vehicleIdentifiedResult,
        valuationCompleteResult,
        tenCompsResult,
      ])
    }

    // Generate PDF
    await writeProgressStep(reportId, 'pdf')
    console.log(`[Webhook] PDF generation starting for report ${reportId}`)
    let pdfResult: { success: boolean; error?: string }
    try {
      pdfResult = await generateAndUploadPDF({ reportId })
    } catch (error) {
      pdfResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
    const pdfBuiltResult = runCheck('pdf_built', { ...qaContext, pdfResult })
    if (!pdfBuiltResult.passed) {
      console.error(`[Webhook] PDF generation failed for report ${reportId}:`, pdfResult.error)
      return holdReport(reportId, 'needs_review', [
        vehicleIdentifiedResult,
        valuationCompleteResult,
        tenCompsResult,
        pdfBuiltResult,
      ])
    }
    console.log(`[Webhook] PDF generation completed for report ${reportId}`)
    return releaseReport(reportId)
  } catch (error) {
    console.error(
      `[Webhook] Unhandled error in post-payment processing for report ${reportId}:`,
      error
    )
    return holdReport(reportId, 'needs_review', [
      {
        key: 'pipeline_error',
        label: 'Pipeline error',
        passed: false,
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
    ])
  }
}
