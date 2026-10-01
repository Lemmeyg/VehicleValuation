# Report Delivery — Pipeline Extraction & QA Gate (Build Steps 1-3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the LemonSqueezy webhook's post-payment work into a reusable, unit-testable `runReportPipeline` function, then add the four-check QA gate so a report only reaches `completed` when it is genuinely ready — fixing the silent PDF-failure bug along the way.

**Architecture:** Move the `after()` callback body out of `app/api/lemonsqueezy/webhook/route.ts` into `lib/services/report-pipeline.ts` with no behavior change (Task 2), then layer in `paid_at`/`access_token_expires_at` writes, `progress_step` writes, and a QA check registry (`lib/services/qa-checks.ts`) that gates release vs. hold (Tasks 3-5). The webhook's `after()` step remains the only trigger — no new job system.

**Tech Stack:** Next.js 16 App Router (Node runtime), Supabase Postgres via `supabaseAdmin`, Jest + `next/jest` (existing config), TypeScript.

**Spec:** `docs/Inbox/report-delivery-prd.md` (v2.1) — this plan implements build order §20, steps 1-3 only. Executors should read PRD §5 (statuses), §6 (pipeline), and §7 (QA gate) alongside this plan; §17 (bugs 3 and 4) explains why Tasks 3-5 exist.

## Global Constraints

- Never commit or push to `main` — branch from up-to-date `main`, PR + Vercel Preview, merge only with Skip's explicit confirmation.
- `npm run type-check` and `npm run test:ci` must pass before any task is considered done (PRD AC-18).
- No new background-job system — keep the webhook's `after()` step as the only trigger (PRD D12).
- `valuation_failed` and `vin_decode_failed` status strings must never be renamed — `valuation_failed` is relied on by the separate `manual-valuation-builder` workstream (PRD §5.1).
- Keep the QA gate logic inside the pipeline, never inside `generateAndUploadPDF` — that function has six other callers (`create-free`, `create-radius-corrected-report`, `manual-valuation`, `regenerate-pdf`, `generate-pdf` route, and this pipeline) and must keep working unchanged for all of them (PRD §6.5).
- `ten_comps_displayed` must call `selectDisplayComparables(marketcheck_valuation, subject)` with exactly the arguments `/view` uses: `{ year, mileage, zip, model, trim }` (PRD §7).
- `valuation_complete` must check the raw MarketCheck `priceRange.min`/`priceRange.max`, never the filled-in `valuation_result.lowValue`/`highValue` — the code always synthesizes those from a ±10% fallback, so checking them can never fail (PRD §7 note).
- This plan stops at PRD build step 3. Steps 4-12 (status endpoint rewrite, UI screens, checkout redirect, Zoho enrollment, access-token lifetime, refunds, admin, sweep, tracking events, copy sweep) are out of scope here and will be planned in a follow-up session once this pipeline change is reviewed.
- `ZOHO_CAMPAIGNS_REPORT_HELD_LIST_KEY` is **not yet set** in Vercel (confirmed via `vercel env ls production`, 2026-09-26) — irrelevant to this plan (Zoho wiring is build step 7) but do not assume it exists if any later task references it.

## Review Focus

1. **Duplicate webhook delivery must not re-run the pipeline or re-stamp timestamps.** The existing `payments` insert 23505-conflict branch returns before the new `paid_at`/`access_token_expires_at` write is reached — a retry of an already-processed order must still short-circuit there. (Task 4)
2. **`generateAndUploadPDF` returning `{ success: false }` (not throwing) must hold the report as `needs_review` with `pdf_built` failed** — this is the exact silent-failure bug (PRD §17 bug 3) Task 5 exists to fix; today it leaves the report `pending` forever with no email and no flag. (Task 5)
3. **The `ten_comps_displayed` check must be a `>= 10` boundary, not "some low number."** A report with exactly 9 displayed comps must fail; exactly 10 must pass. (Task 3)
4. **`valuation_complete` must fail when MarketCheck returns a price but no raw `priceRange`,** even though `valuation_result.lowValue`/`highValue` would already be filled in by the existing ±10% fallback — this is the exact trap the PRD warns can never fail if the wrong field is checked. (Task 3)
5. **An exception thrown during PDF generation itself (not just a `{ success: false }` return) must still result in a `needs_review` hold**, not bubble up to the outer catch and get swallowed silently the way an unhandled exception is today. (Task 5)

---

## File structure

**Create:**

- `supabase/migrations/20260926000000_add_report_delivery_qa_columns.sql` — the one migration from PRD §15.
- `lib/services/report-pipeline.ts` — `runReportPipeline()`, extracted then extended with progress/QA/hold/release.
- `lib/services/qa-checks.ts` — the four-check registry (`QA_CHECKS`), `QaCheckContext`/`QaCheckResult`/`QaCheck` types, `runQaChecks()` helper.
- `__tests__/lib/services/report-pipeline.test.ts` — unit tests calling `runReportPipeline` directly.
- `__tests__/lib/services/qa-checks.test.ts` — unit tests for each of the four checks.

**Modify:**

- `app/api/lemonsqueezy/webhook/route.ts` — replace the inline `after()` body with a call to `runReportPipeline`; add the `paid_at`/`access_token_expires_at` write after the payment insert; drop now-unused imports.

**Untouched (regression net):**

- `__tests__/app/api/lemonsqueezy/webhook/route.test.ts` — the existing 1,332-line suite exercises the whole pipeline end-to-end through `POST` + `after()`. It must still pass, unmodified, after Tasks 2 and 5 — that's the parity proof for the extraction and the regression proof for the QA gate.

---

### Task 1: Migration file

**Files:**

- Create: `supabase/migrations/20260926000000_add_report_delivery_qa_columns.sql`

**Interfaces:**

- Produces: the columns `paid_at`, `progress_step`, `qa_results`, `qa_failed_checks`, `qa_evaluated_at`, `build_ms`, `review_email_enrolled_at` on `public.reports`, and the `needs_review`/`refunded` status values — Tasks 4 and 5 write to these columns; later plan sessions (steps 4+) read them.

- [ ] **Step 1: Write the migration file**

```sql
-- Report Delivery & QA Gate (docs/Inbox/report-delivery-prd.md §15)
-- Apply manually in the Supabase SQL editor per repo convention — this repo has
-- no Supabase CLI. Skip must run this before any build-step-3+ code that writes
-- these columns reaches production.

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_status_check CHECK (status IN (
  'draft','pending','completed','failed','vin_decode_failed','valuation_failed',
  'needs_review','refunded'));

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS progress_step text,            -- comps | listings | valuation | pdf
  ADD COLUMN IF NOT EXISTS qa_results jsonb,              -- [{key,label,passed,detail}]
  ADD COLUMN IF NOT EXISTS qa_failed_checks text[],
  ADD COLUMN IF NOT EXISTS qa_evaluated_at timestamptz,
  ADD COLUMN IF NOT EXISTS build_ms integer,              -- paid_at → release, for tracking
  ADD COLUMN IF NOT EXISTS review_email_enrolled_at timestamptz;

CREATE INDEX IF NOT EXISTS reports_status_paid_at_idx ON public.reports (status, paid_at);
NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Self-review against PRD §15**

Diff the file above against `docs/Inbox/report-delivery-prd.md` §15 line by line — it must be a verbatim copy (the PRD's own SQL is already final). Confirm no columns were added or dropped beyond what §15 lists.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260926000000_add_report_delivery_qa_columns.sql
git commit -m "$(cat <<'EOF'
Add report-delivery QA gate migration (PRD §15)

Adds paid_at, progress_step, qa_results, qa_failed_checks, qa_evaluated_at,
build_ms, review_email_enrolled_at columns and the needs_review/refunded
status values. Apply manually in the Supabase SQL editor before deploying
the code in later tasks that writes these columns.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

Note in the PR description (written once at the end of Task 5) that Skip must apply this migration in the Supabase SQL editor before merging.

---

### Task 2: Extract `runReportPipeline` — no behavior change

**Files:**

- Create: `lib/services/report-pipeline.ts`
- Create: `__tests__/lib/services/report-pipeline.test.ts`
- Modify: `app/api/lemonsqueezy/webhook/route.ts:1-16` (imports), `:230-668` (the `after()` block)

**Interfaces:**

- Produces: `runReportPipeline(reportId: string, opts?: RunPipelineOptions): Promise<void>`, `RunPipelineOptions { payment?: RunPipelinePaymentInfo; refetch?: boolean }`, `RunPipelinePaymentInfo { amount: number; orderId: string; customerEmail?: string; resolvedUserId?: string | null; rawUserId?: string | null }`. Task 5 extends this same function; the webhook route (Task 4) is its only caller for now.
- Consumes: nothing from earlier tasks.

The full body of today's `after(async () => { ... })` (lines 231-666 of the current `route.ts`) moves into `runReportPipeline`, unchanged except: (a) the outer-scope closures `orderId`, `amount`, `resolvedUserId`, `rawUserId`, `customerEmail` become `opts.payment?.orderId` etc., and (b) the two `updateData` writes that used them (`price_paid`/`stripe_payment_id`, and the anonymous-purchase `user_id`/`email` stamp) are guarded by `if (opts.payment)` so the function is safe to call without payment info later (the webhook always passes it, so this guard changes nothing for today's behavior).

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/services/report-pipeline.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { runReportPipeline } from '@/lib/services/report-pipeline'
import { supabaseAdmin } from '@/lib/db/supabase'
import * as marketcheck from '@/lib/api/marketcheck-client'
import * as autodev from '@/lib/api/autodev-client'
import * as pdfGenerator from '@/lib/services/pdf-generator'
import { validateListingUrls } from '@/lib/utils/url-validator'
import { supplementComparables } from '@/lib/utils/comparables-supplementer'
import { logApiCall } from '@/lib/api/api-call-logger'

jest.mock('@/lib/api/api-call-logger', () => ({
  logApiCall: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}))
jest.mock('@/lib/api/marketcheck-client')
jest.mock('@/lib/api/autodev-client')
jest.mock('@/lib/services/pdf-generator', () => ({
  generateAndUploadPDF: jest.fn(),
}))
jest.mock('@/lib/utils/url-validator', () => ({
  validateListingUrls: jest.fn(),
}))
jest.mock('@/lib/utils/comparables-supplementer', () => ({
  supplementComparables: jest.fn(),
}))

const mockAdmin = supabaseAdmin as jest.Mocked<typeof supabaseAdmin>
const mockValidateListingUrls = validateListingUrls as jest.MockedFunction<
  typeof validateListingUrls
>
const mockSupplementComparables = supplementComparables as jest.MockedFunction<
  typeof supplementComparables
>

function mockReportsTable(reportRow: Record<string, unknown>) {
  const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) })
  const mockFrom = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: reportRow, error: null }),
    update: mockUpdate,
  })
  mockAdmin.from = mockFrom as unknown as typeof mockAdmin.from
  return { mockFrom, mockUpdate }
}

describe('runReportPipeline — payment-info guard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(autodev.fetchAutoDevVinDecode as jest.Mock).mockResolvedValue({
      success: true,
      data: { make: 'Honda', model: 'Accord', vehicle: { year: 2021 }, vinValid: true },
    })
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        predictedPrice: 25000,
        confidence: 'high',
        totalComparablesFound: 10,
        recentComparables: { num_found: 5, listings: [] },
      },
    })
    mockValidateListingUrls.mockImplementation(async prediction => ({
      prediction,
      stats: { checkedCount: 0, failedCount: 0, failedUrls: [], validatedUrls: [], batchesUsed: 0 },
    }))
    mockSupplementComparables.mockImplementation(async prediction => ({
      prediction,
      supplemented: false,
    }))
    ;(pdfGenerator.generateAndUploadPDF as jest.Mock).mockResolvedValue({
      success: true,
      pdfUrl: 'https://example.com/r.pdf',
    })
  })

  it('does not write price_paid/stripe_payment_id/user_id/email when called without opts.payment', async () => {
    const { mockUpdate } = mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: null,
      marketcheck_valuation: null,
    })

    await runReportPipeline('report-1')

    const allUpdateArgs = mockUpdate.mock.calls.map(call => call[0])
    const reportUpdateArg = allUpdateArgs.find(arg => 'marketcheck_valuation' in arg)
    expect(reportUpdateArg).toBeDefined()
    expect(reportUpdateArg).not.toHaveProperty('price_paid')
    expect(reportUpdateArg).not.toHaveProperty('stripe_payment_id')
    expect(reportUpdateArg).not.toHaveProperty('user_id')
    expect(reportUpdateArg).not.toHaveProperty('email')
  })

  it('writes price_paid and stripe_payment_id when opts.payment is provided', async () => {
    const { mockUpdate } = mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: null,
      marketcheck_valuation: null,
    })

    await runReportPipeline('report-1', {
      payment: { amount: 2900, orderId: 'order-123', rawUserId: 'user-1' },
    })

    const allUpdateArgs = mockUpdate.mock.calls.map(call => call[0])
    const reportUpdateArg = allUpdateArgs.find(arg => 'marketcheck_valuation' in arg)
    expect(reportUpdateArg).toMatchObject({ price_paid: 2900, stripe_payment_id: 'order-123' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/services/report-pipeline.test.ts`
Expected: FAIL — `Cannot find module '@/lib/services/report-pipeline'`

- [ ] **Step 3: Create `lib/services/report-pipeline.ts`**

```ts
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

/**
 * Runs every post-payment step for a report: VIN decode, MarketCheck valuation,
 * comp URL validation/supplement, and PDF generation. Called from the LemonSqueezy
 * webhook's after() step (payment supplied); a future admin re-run and daily sweep
 * will call it without payment (docs/Inbox/report-delivery-prd.md §6.1).
 */
export async function runReportPipeline(
  reportId: string,
  opts: RunPipelineOptions = {}
): Promise<void> {
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
      return
    }
    console.log(`[WH-6] Report fetched OK for report ${reportId}`)

    console.log(`[Webhook] Report ${reportId} fetched for API calls:`, {
      vin: report.vin?.substring(0, 8) + '...',
      mileage: report.mileage,
      zip_code: report.zip_code,
      hasExistingMarketCheck: !!report.marketcheck_valuation,
    })

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
      return
    }

    console.log(`[Webhook] Report ${reportId} updated with payment info and API data`)

    // VIN decode failed — flag for manual review, skip PDF
    const hasVehicleData = autodevVinData || report.vehicle_data?.year
    if (!hasVehicleData) {
      console.warn(
        `[Webhook] VIN decode failed for report ${reportId} — flagging for manual review`
      )
      const { error: flagError } = await supabase
        .from('reports')
        .update({ status: 'vin_decode_failed' })
        .eq('id', reportId)
      if (flagError) {
        console.error(
          `[Webhook] Failed to flag report ${reportId} as vin_decode_failed:`,
          flagError
        )
      }
      console.log(`[Webhook] Report ${reportId} set to vin_decode_failed, skipping PDF`)
      return
    }

    if (!marketcheckData) {
      console.warn(
        `[Webhook] No MarketCheck valuation for report ${reportId} after all fallbacks — flagging for manual review`
      )
      const { error: flagError } = await supabase
        .from('reports')
        .update({ status: 'valuation_failed' })
        .eq('id', reportId)
      if (flagError) {
        console.error(`[Webhook] Failed to flag report ${reportId} as valuation_failed:`, flagError)
      }
      console.log(`[Webhook] Report ${reportId} set to valuation_failed, skipping PDF`)
      return
    }

    // Generate PDF
    try {
      console.log(`[Webhook] PDF generation starting for report ${reportId}`)
      await generateAndUploadPDF({ reportId })
      console.log(`[Webhook] PDF generation completed for report ${reportId}`)
    } catch (error) {
      console.error(`[Webhook] PDF generation failed for report ${reportId}:`, error)
      await supabase.from('reports').update({ status: 'failed' }).eq('id', reportId)
      console.log(`[Webhook] Report ${reportId} marked as failed`)
    }
  } catch (error) {
    console.error(
      `[Webhook] Unhandled error in post-payment processing for report ${reportId}:`,
      error
    )
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/services/report-pipeline.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Update `app/api/lemonsqueezy/webhook/route.ts`**

Replace the import block (lines 1-15):

```ts
import { NextRequest, NextResponse, after } from 'next/server'
import { verifyWebhookSignature } from '@/lib/lemonsqueezy/client'
import { supabaseAdmin } from '@/lib/db/supabase'
import { logApiCall } from '@/lib/api/api-call-logger'
import type { LemonSqueezyWebhookEvent } from '@/lib/lemonsqueezy/types'
import { upsertLead } from '@/lib/leads'
import { runReportPipeline } from '@/lib/services/report-pipeline'
```

(Drops `generateAndUploadPDF`, `fetchMarketCheckData`, `fetchAutoDevVinDecode`, `validateListingUrls`, `supplementComparables`, `supplementWithAlternateDealerType`, `gateListings`, `makeScoreSortFn`, `ValidationStats` — all now only used inside `report-pipeline.ts`. Also drop the `const PRIMARY_DEALER_TYPE = 'franchise' as const` line right after the imports — it moved into `report-pipeline.ts`.)

Replace the entire `after(async () => { ... })` block (original lines 231-666) with:

```ts
after(async () => {
  await runReportPipeline(reportId, {
    payment: {
      amount,
      orderId,
      customerEmail,
      resolvedUserId,
      rawUserId,
    },
  })
})
```

- [ ] **Step 6: Run the full existing webhook route suite to prove parity**

Run: `npx jest __tests__/app/api/lemonsqueezy/webhook/route.test.ts`
Expected: PASS — all existing tests (idempotent retry, vin_decode_failed, valuation_failed, comps supplement, lead capture, missing-custom_data fallback, etc.) pass unchanged. This is the parity proof for the extraction; if anything fails, the extraction introduced a behavior change and must be fixed before continuing — do not edit the test file to make it pass.

- [ ] **Step 7: Run type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add lib/services/report-pipeline.ts __tests__/lib/services/report-pipeline.test.ts app/api/lemonsqueezy/webhook/route.ts
git commit -m "$(cat <<'EOF'
Extract runReportPipeline from the webhook's after() step

Moves the post-payment work (VIN decode, MarketCheck, URL validation,
supplement, PDF generation) into lib/services/report-pipeline.ts with no
behavior change, so the admin re-run and daily sweep (later steps) can
call the same function. The existing webhook route test suite passes
unchanged, proving parity.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: QA check registry

**Files:**

- Create: `lib/services/qa-checks.ts`
- Test: `__tests__/lib/services/qa-checks.test.ts`

**Interfaces:**

- Consumes: `MarketCheckPrediction` type from `@/lib/api/marketcheck-client`, `selectDisplayComparables` from `@/lib/utils/comparables-ranker`.
- Produces: `QaCheckContext { autodevVinData: Record<string, unknown> | null; vehicleDataYear: number | string | null | undefined; marketcheckData: MarketCheckPrediction | null; subject: { year: number; mileage: number; zip: string | null; model?: string; trim?: string }; pdfResult?: { success: boolean; error?: string } }`, `QaCheckResult { key: string; label: string; passed: boolean; detail: string }`, `QaCheck { key: string; label: string; run(ctx: QaCheckContext): QaCheckResult }`, `QA_CHECKS: QaCheck[]`. Task 5 imports `QA_CHECKS` and these types.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/services/qa-checks.test.ts`:

```ts
import { QA_CHECKS, type QaCheckContext } from '@/lib/services/qa-checks'

function getCheck(key: string) {
  const check = QA_CHECKS.find(c => c.key === key)
  if (!check) throw new Error(`No check registered for key ${key}`)
  return check
}

const baseContext: QaCheckContext = {
  autodevVinData: null,
  vehicleDataYear: null,
  marketcheckData: null,
  subject: { year: 2021, mileage: 35000, zip: '90210', model: 'Accord', trim: undefined },
}

describe('vehicle_identified', () => {
  it('passes when autodevVinData is present', () => {
    const result = getCheck('vehicle_identified').run({
      ...baseContext,
      autodevVinData: { make: 'Honda' },
    })
    expect(result.passed).toBe(true)
  })

  it('passes when vehicleDataYear is set and autodevVinData is absent', () => {
    const result = getCheck('vehicle_identified').run({ ...baseContext, vehicleDataYear: 2019 })
    expect(result.passed).toBe(true)
  })

  it('fails when neither is present', () => {
    const result = getCheck('vehicle_identified').run(baseContext)
    expect(result.passed).toBe(false)
  })
})

describe('valuation_complete', () => {
  it('passes when predictedPrice > 0 and raw priceRange.min/max are both present', () => {
    const result = getCheck('valuation_complete').run({
      ...baseContext,
      marketcheckData: { predictedPrice: 25000, priceRange: { min: 22000, max: 28000 } } as never,
    })
    expect(result.passed).toBe(true)
  })

  it('fails when priceRange is missing even though predictedPrice > 0 (the ±10% fallback trap)', () => {
    const result = getCheck('valuation_complete').run({
      ...baseContext,
      marketcheckData: { predictedPrice: 25000 } as never,
    })
    expect(result.passed).toBe(false)
  })

  it('fails when predictedPrice is 0', () => {
    const result = getCheck('valuation_complete').run({
      ...baseContext,
      marketcheckData: { predictedPrice: 0, priceRange: { min: 0, max: 0 } } as never,
    })
    expect(result.passed).toBe(false)
  })
})

describe('ten_comps_displayed', () => {
  function makeListings(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      vin: `COMP${i}`,
      price: 25000,
      miles: 30000,
      url_validated: true,
      source_tier: 'primary',
    }))
  }

  it('fails with exactly 9 displayed comps', () => {
    const result = getCheck('ten_comps_displayed').run({
      ...baseContext,
      marketcheckData: {
        predictedPrice: 25000,
        recentComparables: { listings: makeListings(9) },
      } as never,
    })
    expect(result.passed).toBe(false)
    expect(result.detail).toContain('9 displayed')
  })

  it('passes with exactly 10 displayed comps', () => {
    const result = getCheck('ten_comps_displayed').run({
      ...baseContext,
      marketcheckData: {
        predictedPrice: 25000,
        recentComparables: { listings: makeListings(10) },
      } as never,
    })
    expect(result.passed).toBe(true)
    expect(result.detail).toContain('10 displayed')
  })
})

describe('pdf_built', () => {
  it('passes when pdfResult.success is true', () => {
    const result = getCheck('pdf_built').run({ ...baseContext, pdfResult: { success: true } })
    expect(result.passed).toBe(true)
  })

  it('fails when pdfResult.success is false', () => {
    const result = getCheck('pdf_built').run({
      ...baseContext,
      pdfResult: { success: false, error: 'upload failed' },
    })
    expect(result.passed).toBe(false)
    expect(result.detail).toContain('upload failed')
  })

  it('fails when pdfResult is absent', () => {
    const result = getCheck('pdf_built').run(baseContext)
    expect(result.passed).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/services/qa-checks.test.ts`
Expected: FAIL — `Cannot find module '@/lib/services/qa-checks'`

- [ ] **Step 3: Create `lib/services/qa-checks.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/services/qa-checks.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Run type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/services/qa-checks.ts __tests__/lib/services/qa-checks.test.ts
git commit -m "$(cat <<'EOF'
Add the four-check QA registry (PRD §7)

vehicle_identified, valuation_complete (raw priceRange, not the ±10%
fallback), ten_comps_displayed (via selectDisplayComparables), and
pdf_built. Not yet wired into the pipeline — that's the next commit.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `paid_at` / `access_token_expires_at` on payment insert

**Files:**

- Modify: `app/api/lemonsqueezy/webhook/route.ts` (inside `handleOrderCreated`, right after the `[WH-5b]` lead-capture block and before the `after()` call added in Task 2)
- Modify: `__tests__/app/api/lemonsqueezy/webhook/route.test.ts` (add one test)

**Interfaces:**

- Consumes: nothing new.
- Produces: `reports.paid_at` and `reports.access_token_expires_at` set synchronously in the request path, before `after()` runs — later plan sessions (the 120s display window, step 8) read `paid_at`.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/app/api/lemonsqueezy/webhook/route.test.ts`, inside the `describe('POST /api/lemonsqueezy/webhook — order processing', ...)` block (reuses that block's existing `beforeEach` mocks):

```ts
it('sets paid_at and access_token_expires_at (+7 days) on the report after a successful payment insert', async () => {
  let capturedPaidAtUpdate: Record<string, unknown> | null = null
  const mockUpdate = jest.fn().mockImplementation((data: Record<string, unknown>) => {
    if ('paid_at' in data) capturedPaidAtUpdate = data
    return { eq: jest.fn().mockResolvedValue({ error: null }) }
  })
  const mockFrom = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        vin: '1HGBH41JXMN109186',
        mileage: 35000,
        zip_code: '90210',
        vehicle_data: null,
        marketcheck_valuation: null,
      },
      error: null,
    }),
    insert: jest.fn().mockResolvedValue({ error: null }),
    update: mockUpdate,
    upsert: jest.fn().mockResolvedValue({ error: null }),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockAdmin.from = mockFrom as any

  const before = Date.now()
  const request = new Request('http://localhost/api/lemonsqueezy/webhook', {
    method: 'POST',
    headers: {
      'x-signature': 'valid',
      'x-forwarded-host': 'www.totallosstoolkit.com',
      'x-forwarded-proto': 'https',
    },
    body: makeOrderCreatedBody(),
  })

  await POST(request)

  expect(capturedPaidAtUpdate).not.toBeNull()
  const arg = capturedPaidAtUpdate as unknown as {
    paid_at: string
    access_token_expires_at: string
  }
  const paidAtMs = new Date(arg.paid_at).getTime()
  const expiresMs = new Date(arg.access_token_expires_at).getTime()
  expect(paidAtMs).toBeGreaterThanOrEqual(before)
  expect(expiresMs - paidAtMs).toBeCloseTo(7 * 24 * 60 * 60 * 1000, -3)
})

it('does not write paid_at on a duplicate delivery (idempotent retry)', async () => {
  const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) })
  const mockFrom = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        vin: '1HGBH41JXMN109186',
        mileage: 35000,
        zip_code: '90210',
        vehicle_data: null,
        marketcheck_valuation: null,
      },
      error: null,
    }),
    insert: jest.fn().mockResolvedValue({
      error: { code: '23505', message: 'duplicate key', details: 'already exists' },
    }),
    update: mockUpdate,
    upsert: jest.fn().mockResolvedValue({ error: null }),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockAdmin.from = mockFrom as any

  const request = new Request('http://localhost/api/lemonsqueezy/webhook', {
    method: 'POST',
    headers: {
      'x-signature': 'valid',
      'x-forwarded-host': 'www.totallosstoolkit.com',
      'x-forwarded-proto': 'https',
    },
    body: makeOrderCreatedBody(),
  })

  await POST(request)

  const paidAtCalls = mockUpdate.mock.calls.filter(call => 'paid_at' in call[0])
  expect(paidAtCalls).toHaveLength(0)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/app/api/lemonsqueezy/webhook/route.test.ts -t "paid_at"`
Expected: FAIL — `capturedPaidAtUpdate` is `null` (no such write exists yet).

- [ ] **Step 3: Add the write in `route.ts`**

In `handleOrderCreated`, immediately after the existing lead-capture block (the `if (customerEmail) { try { await upsertLead(...) } ... }` block, i.e. right before the `// ── Return 200 quickly...` comment and the `after(...)` call), add:

```ts
// Set the report page's access window (payment + 7 days) and mark when it
// was paid — the 120s display window (a later build step) reads paid_at.
// Reset on release too (§6.5 / a later task); this is the payment-time value.
const paidAt = new Date().toISOString()
const accessTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
const { error: paidAtError } = await supabase
  .from('reports')
  .update({ paid_at: paidAt, access_token_expires_at: accessTokenExpiresAt })
  .eq('id', reportId)
if (paidAtError) {
  console.error('[WH-5c] Failed to set paid_at/access_token_expires_at:', paidAtError)
  // Non-fatal — the pipeline still runs; a later plan session's daily sweep
  // (PRD §8.3) is unaffected since it keys off price_paid, not paid_at, for
  // reports it re-checks, and admins can inspect this via logs.
}
```

This must sit **after** the idempotent-retry `return` inside the payment-insert error handling (so a duplicate delivery never reaches it) and **before** the `after(...)` call from Task 2.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/app/api/lemonsqueezy/webhook/route.test.ts`
Expected: PASS — the 2 new tests plus every existing test in the file (regression check for this task).

- [ ] **Step 5: Run type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/lemonsqueezy/webhook/route.ts __tests__/app/api/lemonsqueezy/webhook/route.test.ts
git commit -m "$(cat <<'EOF'
Set paid_at and access_token_expires_at on payment insert (PRD §6.3 step 1)

Written synchronously after the payment record is created, guarded by the
existing idempotent-retry early return so a duplicate webhook delivery
never re-stamps it. access_token_expires_at is payment + 7 days; a later
task resets it to release + 7 days when the report is released.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Wire the QA gate into `runReportPipeline` — progress steps, hold/release, fix the silent PDF-failure bug

**Files:**

- Modify: `lib/services/report-pipeline.ts` (the file Task 2 created)
- Modify: `__tests__/lib/services/report-pipeline.test.ts` (add new `describe` blocks)

**Interfaces:**

- Consumes: `QA_CHECKS`, `QaCheckContext`, `QaCheckResult` from `@/lib/services/qa-checks` (Task 3).
- Produces: `runReportPipeline` now returns `Promise<'completed' | 'held'>` instead of `Promise<void>` (matches PRD §6.1's signature) — no other task in this plan consumes the return value yet, but the admin re-run (a later plan session, PRD §14) will.

This task adds, inside the existing function body from Task 2, in order:

1. A `progress_step` write at the start of each of the four stages.
2. A shared `holdReport()` helper and a shared `releaseReport()` helper.
3. Formal QA-check evaluation at each existing decision point, replacing the bare status writes with `holdReport()` calls that also persist `qa_results`/`qa_failed_checks`/`qa_evaluated_at`.
4. The PDF bug fix: check the return value of `generateAndUploadPDF` instead of only catching a thrown exception.
5. An outer-catch hold, so an unexpected exception no longer leaves the report `pending` forever.

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/lib/services/report-pipeline.test.ts` (new file-level imports and a new `describe` block; keep the existing `describe('runReportPipeline — payment-info guard', ...)` block as-is — it must still pass):

```ts
import { supabaseAdmin } from '@/lib/db/supabase'
// (other imports already present from Task 2 — add:)
```

Add these `describe` blocks at the end of the file:

```ts
describe('runReportPipeline — progress_step writes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(autodev.fetchAutoDevVinDecode as jest.Mock).mockResolvedValue({
      success: true,
      data: { make: 'Honda', model: 'Accord', vehicle: { year: 2021 }, vinValid: true },
    })
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        predictedPrice: 25000,
        priceRange: { min: 22000, max: 28000 },
        confidence: 'high',
        totalComparablesFound: 10,
        recentComparables: {
          num_found: 10,
          listings: Array.from({ length: 10 }, (_, i) => ({
            vin: `COMP${i}`,
            price: 25000,
            miles: 30000,
            url_validated: true,
            source_tier: 'primary',
          })),
        },
      },
    })
    mockValidateListingUrls.mockImplementation(async prediction => ({
      prediction,
      stats: { checkedCount: 0, failedCount: 0, failedUrls: [], validatedUrls: [], batchesUsed: 0 },
    }))
    mockSupplementComparables.mockImplementation(async prediction => ({
      prediction,
      supplemented: false,
    }))
    ;(pdfGenerator.generateAndUploadPDF as jest.Mock).mockResolvedValue({
      success: true,
      pdfUrl: 'https://example.com/r.pdf',
    })
  })

  it('writes progress_step comps, listings, valuation, then pdf, in order', async () => {
    const progressSteps: string[] = []
    const mockUpdate = jest.fn().mockImplementation((data: Record<string, unknown>) => {
      if (typeof data.progress_step === 'string') progressSteps.push(data.progress_step)
      return { eq: jest.fn().mockResolvedValue({ error: null }) }
    })
    mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: null,
      marketcheck_valuation: null,
    })
    ;(supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          vin: '1HGBH41JXMN109186',
          mileage: 35000,
          zip_code: '90210',
          vehicle_data: null,
          marketcheck_valuation: null,
        },
        error: null,
      }),
      update: mockUpdate,
    })

    await runReportPipeline('report-1')

    expect(progressSteps).toEqual(['comps', 'listings', 'valuation', 'pdf'])
  })
})

describe('runReportPipeline — QA gate', () => {
  function setupHappyPathMocks() {
    ;(autodev.fetchAutoDevVinDecode as jest.Mock).mockResolvedValue({
      success: true,
      data: { make: 'Honda', model: 'Accord', vehicle: { year: 2021 }, vinValid: true },
    })
    mockValidateListingUrls.mockImplementation(async prediction => ({
      prediction,
      stats: { checkedCount: 0, failedCount: 0, failedUrls: [], validatedUrls: [], batchesUsed: 0 },
    }))
    mockSupplementComparables.mockImplementation(async prediction => ({
      prediction,
      supplemented: false,
    }))
  }

  beforeEach(() => {
    jest.clearAllMocks()
    setupHappyPathMocks()
  })

  it('holds as needs_review with ten_comps_displayed failed when fewer than 10 comps are displayed', async () => {
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        predictedPrice: 25000,
        priceRange: { min: 22000, max: 28000 },
        recentComparables: {
          num_found: 3,
          listings: Array.from({ length: 3 }, (_, i) => ({
            vin: `COMP${i}`,
            price: 25000,
            miles: 30000,
            url_validated: true,
            source_tier: 'primary',
          })),
        },
      },
    })
    const { mockUpdate } = mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: null,
      marketcheck_valuation: null,
    })

    const outcome = await runReportPipeline('report-1')

    expect(outcome).toBe('held')
    const holdUpdate = mockUpdate.mock.calls
      .map(c => c[0])
      .find(arg => arg.status === 'needs_review')
    expect(holdUpdate).toBeDefined()
    expect(holdUpdate.qa_failed_checks).toContain('ten_comps_displayed')
    expect(pdfGenerator.generateAndUploadPDF).not.toHaveBeenCalled()
  })

  it('holds as needs_review with valuation_complete failed when priceRange is missing (the ±10% fallback trap)', async () => {
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        predictedPrice: 25000,
        // no priceRange — the pipeline's own valuation_result fallback would
        // fill lowValue/highValue, but the raw priceRange is what must be checked.
        recentComparables: { num_found: 0, listings: [] },
      },
    })
    const { mockUpdate } = mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: null,
      marketcheck_valuation: null,
    })

    const outcome = await runReportPipeline('report-1')

    expect(outcome).toBe('held')
    const holdUpdate = mockUpdate.mock.calls
      .map(c => c[0])
      .find(arg => arg.status === 'needs_review')
    expect(holdUpdate.qa_failed_checks).toContain('valuation_complete')
  })

  it('releases (completed via generateAndUploadPDF) when all four checks pass', async () => {
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        predictedPrice: 25000,
        priceRange: { min: 22000, max: 28000 },
        recentComparables: {
          num_found: 10,
          listings: Array.from({ length: 10 }, (_, i) => ({
            vin: `COMP${i}`,
            price: 25000,
            miles: 30000,
            url_validated: true,
            source_tier: 'primary',
          })),
        },
      },
    })
    ;(pdfGenerator.generateAndUploadPDF as jest.Mock).mockResolvedValue({
      success: true,
      pdfUrl: 'https://example.com/r.pdf',
    })
    const { mockUpdate } = mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: null,
      marketcheck_valuation: null,
    })

    const outcome = await runReportPipeline('report-1')

    expect(outcome).toBe('completed')
    expect(pdfGenerator.generateAndUploadPDF).toHaveBeenCalledWith({ reportId: 'report-1' })
    const releaseUpdate = mockUpdate.mock.calls
      .map(c => c[0])
      .find(arg => 'access_token_expires_at' in arg)
    expect(releaseUpdate).toBeDefined()
  })

  it('holds as needs_review with pdf_built failed when generateAndUploadPDF returns success: false (the silent-failure bug)', async () => {
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        predictedPrice: 25000,
        priceRange: { min: 22000, max: 28000 },
        recentComparables: {
          num_found: 10,
          listings: Array.from({ length: 10 }, (_, i) => ({
            vin: `COMP${i}`,
            price: 25000,
            miles: 30000,
            url_validated: true,
            source_tier: 'primary',
          })),
        },
      },
    })
    ;(pdfGenerator.generateAndUploadPDF as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Failed to upload PDF',
    })
    const { mockUpdate } = mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: null,
      marketcheck_valuation: null,
    })

    const outcome = await runReportPipeline('report-1')

    expect(outcome).toBe('held')
    const holdUpdate = mockUpdate.mock.calls
      .map(c => c[0])
      .find(arg => arg.status === 'needs_review')
    expect(holdUpdate).toBeDefined()
    expect(holdUpdate.qa_failed_checks).toContain('pdf_built')
    // Must never leave the report silently pending forever (PRD §17 bug 3).
    expect(
      mockUpdate.mock.calls.some(c => c[0].status === 'pending' && Object.keys(c[0]).length === 1)
    ).toBe(false)
  })

  it('holds as needs_review with a pipeline_error check when generateAndUploadPDF throws', async () => {
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        predictedPrice: 25000,
        priceRange: { min: 22000, max: 28000 },
        recentComparables: {
          num_found: 10,
          listings: Array.from({ length: 10 }, (_, i) => ({
            vin: `COMP${i}`,
            price: 25000,
            miles: 30000,
            url_validated: true,
            source_tier: 'primary',
          })),
        },
      },
    })
    ;(pdfGenerator.generateAndUploadPDF as jest.Mock).mockRejectedValue(
      new Error('renderToBuffer crashed')
    )
    const { mockUpdate } = mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: null,
      marketcheck_valuation: null,
    })

    const outcome = await runReportPipeline('report-1')

    expect(outcome).toBe('held')
    const holdUpdate = mockUpdate.mock.calls
      .map(c => c[0])
      .find(arg => arg.status === 'needs_review')
    expect(holdUpdate.qa_failed_checks).toContain('pdf_built')
  })

  it('holds as needs_review with pipeline_error when an unrelated exception is thrown mid-pipeline', async () => {
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockRejectedValue(new Error('network down'))
    const { mockUpdate } = mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: null,
      marketcheck_valuation: null,
    })

    const outcome = await runReportPipeline('report-1')

    expect(outcome).toBe('held')
    const holdUpdate = mockUpdate.mock.calls
      .map(c => c[0])
      .find(arg => arg.status === 'needs_review')
    expect(holdUpdate).toBeDefined()
    expect(holdUpdate.qa_failed_checks).toContain('pipeline_error')
  })

  it('still writes vin_decode_failed (not needs_review) when the vehicle cannot be identified', async () => {
    ;(autodev.fetchAutoDevVinDecode as jest.Mock).mockResolvedValue({
      success: false,
      error: 'VIN not found',
    })
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: false,
      error: 'no data',
    })
    const { mockUpdate } = mockReportsTable({
      vin: 'BADVIN00000000000',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: { vin: 'BADVIN00000000000' },
      marketcheck_valuation: null,
    })

    const outcome = await runReportPipeline('report-1')

    expect(outcome).toBe('held')
    const holdUpdate = mockUpdate.mock.calls
      .map(c => c[0])
      .find(arg => arg.status === 'vin_decode_failed')
    expect(holdUpdate).toBeDefined()
    expect(holdUpdate.qa_failed_checks).toEqual(['vehicle_identified'])
  })

  it('still writes valuation_failed (not needs_review) when MarketCheck returns nothing at all', async () => {
    ;(marketcheck.fetchMarketCheckData as jest.Mock).mockResolvedValue({
      success: false,
      error: 'no data',
    })
    const { mockUpdate } = mockReportsTable({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zip_code: '90210',
      vehicle_data: { year: 2020 },
      marketcheck_valuation: null,
    })

    const outcome = await runReportPipeline('report-1')

    expect(outcome).toBe('held')
    const holdUpdate = mockUpdate.mock.calls
      .map(c => c[0])
      .find(arg => arg.status === 'valuation_failed')
    expect(holdUpdate).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/services/report-pipeline.test.ts`
Expected: FAIL — `runReportPipeline` still returns `undefined`, no `progress_step`/`qa_failed_checks` writes exist yet.

- [ ] **Step 3: Rewrite `lib/services/report-pipeline.ts`**

Add the import and helpers, change the return type, and rewire the four decision points. Apply these edits to the Task 2 file:

Add to the imports:

```ts
import { QA_CHECKS, type QaCheckContext, type QaCheckResult } from '@/lib/services/qa-checks'
```

Add helpers right after the `RunPipelineOptions` interface:

```ts
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
```

Change the function signature:

```ts
export async function runReportPipeline(
  reportId: string,
  opts: RunPipelineOptions = {}
): Promise<'completed' | 'held'> {
```

Insert a `writeProgressStep(reportId, 'comps')` call right before the `// FETCH AUTO.DEV VIN DECODE DATA` section, and a `writeProgressStep(reportId, 'listings')` call right before the `// URL validation + supplement` section (`if (marketcheckData) { ... }` block). Both are simple additions — the surrounding code is unchanged from Task 2.

Insert a `writeProgressStep(reportId, 'valuation')` call right after `marketcheckData = validatedPrediction` (end of the URL validation + supplement block) and before the `// UPDATE REPORT WITH API DATA AND PAYMENT INFO` section.

Replace the vin_decode_failed branch:

```ts
// VIN decode failed — flag for manual review, skip PDF
const hasVehicleData = autodevVinData || report.vehicle_data?.year
if (!hasVehicleData) {
  console.warn(`[Webhook] VIN decode failed for report ${reportId} — flagging for manual review`)
  const { error: flagError } = await supabase
    .from('reports')
    .update({ status: 'vin_decode_failed' })
    .eq('id', reportId)
  if (flagError) {
    console.error(`[Webhook] Failed to flag report ${reportId} as vin_decode_failed:`, flagError)
  }
  console.log(`[Webhook] Report ${reportId} set to vin_decode_failed, skipping PDF`)
  return
}
```

with:

```ts
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
```

Replace the valuation_failed branch:

```ts
    if (!marketcheckData) {
      console.warn(
        `[Webhook] No MarketCheck valuation for report ${reportId} after all fallbacks — flagging for manual review`
      )
      const { error: flagError } = await supabase
        .from('reports')
        .update({ status: 'valuation_failed' })
        .eq('id', reportId)
      if (flagError) {
        console.error(
          `[Webhook] Failed to flag report ${reportId} as valuation_failed:`,
          flagError
        )
      }
      console.log(`[Webhook] Report ${reportId} set to valuation_failed, skipping PDF`)
      return
    }

    // Generate PDF
    try {
      console.log(`[Webhook] PDF generation starting for report ${reportId}`)
      await generateAndUploadPDF({ reportId })
      console.log(`[Webhook] PDF generation completed for report ${reportId}`)
    } catch (error) {
      console.error(`[Webhook] PDF generation failed for report ${reportId}:`, error)
      await supabase.from('reports').update({ status: 'failed' }).eq('id', reportId)
      console.log(`[Webhook] Report ${reportId} marked as failed`)
    }
  } catch (error) {
    console.error(
      `[Webhook] Unhandled error in post-payment processing for report ${reportId}:`,
      error
    )
  }
}
```

with:

```ts
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
      pdfResult = { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
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
```

(The report-not-found early return and the report-update-failed early return, both still inside the `try` block above this, keep returning `undefined` implicitly — those are pre-payment-data-fetch failures with no reportId-scoped QA context to record; they already log via `logApiCall`/`console.error`. Leaving them as bare `return` matches the function's `Promise<'completed' | 'held'>` return type loosely — TypeScript allows an early `return` with no value in an async function whose return type is a union that doesn't include `void`/`undefined` only if the function's inferred return type stays a union including `undefined`; to keep the type honest, change both of those two bare `return` statements to `return holdReport(reportId, 'needs_review', [{ key: 'pipeline_error', label: 'Pipeline error', passed: false, detail: fetchError?.message ?? 'report not found' }])` and `return holdReport(reportId, 'needs_review', [{ key: 'pipeline_error', label: 'Pipeline error', passed: false, detail: reportError.message }])` respectively, so every code path returns a real outcome.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/services/report-pipeline.test.ts`
Expected: PASS — all tests from Task 2 and Task 5.

- [ ] **Step 5: Run the full existing webhook route suite again**

Run: `npx jest __tests__/app/api/lemonsqueezy/webhook/route.test.ts`
Expected: PASS. Pay particular attention to the `vin_decode_failed` and `valuation_failed` tests (lines ~321 and ~408 of that file) — they assert `mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'vin_decode_failed' }))` etc., and `holdReport` now writes `status` alongside `qa_results`/`qa_failed_checks`/`qa_evaluated_at` in the same call — `objectContaining` still matches. If any assertion in that file breaks, it means the QA gate changed real behavior beyond what PRD §17 intends to fix — stop and re-check against the PRD rather than loosening the test.

- [ ] **Step 6: Run full suite and type-check**

Run: `npm run test:ci`
Run: `npm run type-check`
Expected: both pass, coverage thresholds still met.

- [ ] **Step 7: Commit**

```bash
git add lib/services/report-pipeline.ts __tests__/lib/services/report-pipeline.test.ts
git commit -m "$(cat <<'EOF'
Wire the QA gate into runReportPipeline; fix silent PDF-failure bug

Adds progress_step writes for the four pipeline stages and routes every
hold path (vin_decode_failed, valuation_failed, failed QA checks 2-3,
failed PDF, unexpected exception) through one holdReport() helper that
persists qa_results/qa_failed_checks/qa_evaluated_at. Release now also
extends access_token_expires_at.

Fixes PRD §17 bug 3: generateAndUploadPDF returning { success: false }
(not throwing) previously left the report pending forever with no email
and no flag — it now holds as needs_review with pdf_built failed.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** PRD build steps 1 (Task 1), 2 (Task 2), and 3 (Tasks 3-5) are each covered. Steps 4-12 are explicitly out of scope per the Global Constraints.
- **Placeholder scan:** no TBD/TODO markers; every step has real code.
- **Type consistency:** `RunPipelineOptions`, `RunPipelinePaymentInfo`, `QaCheckContext`, `QaCheckResult`, `QaCheck`, `QA_CHECKS` are defined once (Tasks 2-3) and reused with the same names/shapes in Task 5. `runReportPipeline`'s return type changes once, deliberately, in Task 5 (from `Promise<void>` to `Promise<'completed' | 'held'>`) — noted in that task's Interfaces block.
- **Review Focus:** all five items above are pinned to a specific task's tests (duplicate delivery → Task 4; silent PDF-failure bug → Task 5; 10-comp boundary → Task 3; raw-priceRange trap → Task 3; PDF exception vs. false-return → Task 5).

## After Task 5

Stop here per the user's request — the webhook/pipeline change is ready for review before continuing to PRD build steps 4+ (status endpoint rewrite, UI screens, checkout redirect, Zoho enrollment, access-token/refund handling, admin, sweep, tracking events, copy sweep). Open a PR against `main` with:

- A note that Skip must apply the Task 1 migration in the Supabase SQL editor before merging.
- A note that `ZOHO_CAMPAIGNS_REPORT_HELD_LIST_KEY` is not yet set in Vercel — irrelevant to this PR, relevant to build step 7.
- The full `npm run test:ci` and `npm run type-check` output.
