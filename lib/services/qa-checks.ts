import type { MarketCheckPrediction } from '@/lib/api/marketcheck-client'
import { selectDisplayComparables } from '@/lib/utils/comparables-ranker'

export interface QaCheckContext {
  autodevVinData: Record<string, unknown> | null
  vehicleDataYear: number | string | null | undefined
  marketcheckData: MarketCheckPrediction | null
  subject: { year: number; mileage: number; zip: string | null; model?: string; trim?: string }
  pdfResult?: { success: boolean; error?: string }
}

export interface QaCheckResult {
  key: string
  label: string
  passed: boolean
  detail: string
}

export interface QaCheck {
  key: string
  label: string
  run(ctx: QaCheckContext): QaCheckResult
}

/**
 * The four checks a paid report must pass to be released
 * (docs/Inbox/report-delivery-prd.md §7). Checks 1-3 run at the valuation
 * stage; check 4 is recorded after the PDF step.
 */
export const QA_CHECKS: QaCheck[] = [
  {
    key: 'vehicle_identified',
    label: 'Vehicle identified',
    run(ctx) {
      const passed = !!ctx.autodevVinData || !!ctx.vehicleDataYear
      return {
        key: 'vehicle_identified',
        label: 'Vehicle identified',
        passed,
        detail: passed
          ? 'VIN decoded or vehicle_data.year present'
          : 'No autodev_vin_data and no vehicle_data.year',
      }
    },
  },
  {
    key: 'valuation_complete',
    label: 'Valuation complete',
    run(ctx) {
      // Checks the raw MarketCheck priceRange — never valuation_result.lowValue/
      // highValue, which the pipeline always fills with a ±10% fallback and so
      // can never fail (PRD §7 note).
      const price = ctx.marketcheckData?.predictedPrice ?? 0
      const min = ctx.marketcheckData?.priceRange?.min
      const max = ctx.marketcheckData?.priceRange?.max
      const passed = price > 0 && min != null && max != null
      return {
        key: 'valuation_complete',
        label: 'Valuation complete',
        passed,
        detail: passed
          ? `predictedPrice ${price}, range ${min}-${max}`
          : `predictedPrice ${price}, raw priceRange ${JSON.stringify(ctx.marketcheckData?.priceRange ?? null)}`,
      }
    },
  },
  {
    key: 'ten_comps_displayed',
    label: '10 comparable vehicles displayed',
    run(ctx) {
      const displayed = selectDisplayComparables(ctx.marketcheckData, ctx.subject)
      const passed = displayed.length >= 10
      return {
        key: 'ten_comps_displayed',
        label: '10 comparable vehicles displayed',
        passed,
        detail: `${displayed.length} displayed`,
      }
    },
  },
  {
    key: 'pdf_built',
    label: 'PDF built',
    run(ctx) {
      const passed = ctx.pdfResult?.success === true
      return {
        key: 'pdf_built',
        label: 'PDF built',
        passed,
        detail: passed
          ? 'generateAndUploadPDF returned success: true'
          : (ctx.pdfResult?.error ?? 'generateAndUploadPDF did not run or returned success: false'),
      }
    },
  },
]
