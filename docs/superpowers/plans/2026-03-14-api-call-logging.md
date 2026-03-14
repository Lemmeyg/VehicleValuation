# API Call Logging — Consistent Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace scattered, inconsistent inline `api_call_logs` inserts with a single shared `logApiCall` utility, and migrate `create-anonymous` from a legacy VinAudit API call to Auto.dev.

**Architecture:** A new `lib/api/api-call-logger.ts` module exports one function — `logApiCall()` — that all route handlers call. The function uses `supabaseAdmin` (service role), checks the Supabase error response, and never throws. Each route is updated one at a time, with tests confirming correct field values after each change.

**Tech Stack:** Next.js 16, TypeScript, Supabase JS v2, Jest (test runner), `@/lib/db/supabase` for `supabaseAdmin`.

**Spec:** `docs/superpowers/specs/2026-03-14-api-call-logging-design.md`

---

## File Map

| File                                                        | Action                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------- |
| `lib/api/api-call-logger.ts`                                | **Create** — shared logging utility                              |
| `__tests__/lib/api/api-call-logger.test.ts`                 | **Create** — unit tests for the utility                          |
| `app/api/reports/create/route.ts`                           | **Modify** — remove local helper, use shared utility, fix values |
| `__tests__/app/api/reports/create/route.test.ts`            | **Modify** — assert `logApiCall` called with canonical values    |
| `app/api/reports/[id]/fetch-marketcheck/route.ts`           | **Modify** — replace inline inserts with shared utility          |
| `app/api/lemonsqueezy/webhook/route.ts`                     | **Modify** — replace inline inserts, add missing fields          |
| `__tests__/app/api/lemonsqueezy/webhook/route.test.ts`      | **Modify** — assert canonical `responseData` fields              |
| `app/api/admin/reports/create-free/route.ts`                | **Modify** — replace inline inserts, fix timing and values       |
| `__tests__/app/api/admin/reports/create-free/route.test.ts` | **Modify** — assert timing and canonical fields                  |
| `app/api/reports/create-anonymous/route.ts`                 | **Modify** — migrate VinAudit → Auto.dev, reorder, add logging   |
| `__tests__/app/api/reports/create-anonymous/route.test.ts`  | **Create** — tests for the migrated route                        |

---

## Chunk 1: Shared Logger Utility

### Task 1: Create `logApiCall` utility with tests

**Files:**

- Create: `lib/api/api-call-logger.ts`
- Create: `__tests__/lib/api/api-call-logger.test.ts`

**Context:** The `supabaseAdmin` client is exported from `@/lib/db/supabase`. It never throws — it returns `{ data, error }`. The DB table is `api_call_logs`. The `provider` param maps to the `api_provider` column.

- [ ] **Step 1.1: Write the failing tests**

Create `__tests__/lib/api/api-call-logger.test.ts`:

```typescript
import { logApiCall } from '@/lib/api/api-call-logger'

// Mock supabaseAdmin
const mockInsert = jest.fn()
const mockFrom = jest.fn(() => ({ insert: mockInsert }))

jest.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: { from: mockFrom },
}))

describe('logApiCall', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockInsert.mockResolvedValue({ data: null, error: null })
  })

  it('inserts a row with correct column mapping', async () => {
    await logApiCall({
      reportId: 'report-123',
      provider: 'autodev',
      endpoint: '/vin/{vin}',
      success: true,
      responseTimeMs: 450,
      cost: 0.0,
      requestData: { vin: '1HGBH41JXMN109186' },
      responseData: { make: 'Honda', model: 'Accord', year: 2021, vinValid: true },
    })

    expect(mockFrom).toHaveBeenCalledWith('api_call_logs')
    expect(mockInsert).toHaveBeenCalledWith({
      report_id: 'report-123',
      api_provider: 'autodev',
      endpoint: '/vin/{vin}',
      success: true,
      response_time_ms: 450,
      cost: 0.0,
      request_data: { vin: '1HGBH41JXMN109186' },
      response_data: { make: 'Honda', model: 'Accord', year: 2021, vinValid: true },
      error_message: null,
    })
  })

  it('writes null for omitted optional fields', async () => {
    await logApiCall({
      reportId: 'report-456',
      provider: 'marketcheck',
      endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
      success: false,
      responseTimeMs: 200,
      cost: 0.0,
      errorMessage: 'API timeout',
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        request_data: null,
        response_data: null,
        error_message: 'API timeout',
      })
    )
  })

  it('never throws when supabase returns an error', async () => {
    mockInsert.mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      logApiCall({
        reportId: 'report-789',
        provider: 'autodev',
        endpoint: '/vin/{vin}',
        success: true,
        responseTimeMs: 100,
        cost: 0.0,
      })
    ).resolves.toBeUndefined()

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[logApiCall]'),
      expect.anything()
    )
    consoleSpy.mockRestore()
  })

  it('never throws when an unexpected exception is raised', async () => {
    mockInsert.mockRejectedValue(new Error('network failure'))
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      logApiCall({
        reportId: 'report-000',
        provider: 'autodev',
        endpoint: '/vin/{vin}',
        success: true,
        responseTimeMs: 100,
        cost: 0.0,
      })
    ).resolves.toBeUndefined()

    consoleSpy.mockRestore()
  })
})
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
cd "../Vehicle Comparison Site"
npx jest __tests__/lib/api/api-call-logger.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/api/api-call-logger'`

- [ ] **Step 1.3: Create `lib/api/api-call-logger.ts`**

```typescript
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
```

- [ ] **Step 1.4: Run tests to confirm they pass**

```bash
npx jest __tests__/lib/api/api-call-logger.test.ts --no-coverage
```

Expected: PASS — 4 tests pass

- [ ] **Step 1.5: Run full test suite to confirm no regressions**

```bash
npm run test:ci
```

Expected: All tests pass

- [ ] **Step 1.6: Commit**

```bash
cd "../Vehicle Comparison Site"
git checkout -b feat/consistent-api-call-logging
git add lib/api/api-call-logger.ts __tests__/lib/api/api-call-logger.test.ts
git commit -m "feat: add shared logApiCall utility for api_call_logs"
```

---

## Chunk 2: Update `reports/create/route.ts`

### Task 2: Replace local helper in `create/route.ts` with shared utility

**Files:**

- Modify: `app/api/reports/create/route.ts`
- Modify: `__tests__/app/api/reports/create/route.test.ts`

**Context:** This file has a local `logApiCall` function at lines 390–413 (positional args). There are five call sites. The existing endpoint strings and cost values are wrong — see spec for correct values. The `marketcheckValuation` variable holds the MarketCheck response after a successful call.

- [ ] **Step 2.1: Update tests to assert canonical values**

Open `__tests__/app/api/reports/create/route.test.ts`. Add a mock for the new shared logger and add assertions that it is called with canonical values. Add/update the test that covers a successful full report creation:

```typescript
// At top of file, add:
jest.mock('@/lib/api/api-call-logger')
import { logApiCall } from '@/lib/api/api-call-logger'
const mockLogApiCall = logApiCall as jest.MockedFunction<typeof logApiCall>

// Inside the test for successful report creation, add assertions:
expect(mockLogApiCall).toHaveBeenCalledWith(
  expect.objectContaining({
    provider: 'autodev',
    endpoint: '/vin/{vin}',
    cost: 0.0,
    requestData: { vin: expect.any(String) },
    responseData: expect.objectContaining({
      make: expect.any(String),
      vinValid: expect.any(Boolean),
    }),
  })
)
expect(mockLogApiCall).toHaveBeenCalledWith(
  expect.objectContaining({
    provider: 'marketcheck',
    endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
    cost: 0.09,
    requestData: expect.objectContaining({
      vin: expect.any(String),
      dealer_type: expect.any(String),
    }),
    responseData: expect.objectContaining({
      predicted_price: expect.any(Number),
      total_comparables_found: expect.any(Number),
      recent_comparables_found: expect.any(Number),
    }),
  })
)
```

- [ ] **Step 2.2: Run tests to confirm they fail (logApiCall not yet called with right args)**

```bash
npx jest "__tests__/app/api/reports/create/route.test.ts" --no-coverage
```

Expected: FAIL on the new assertions

- [ ] **Step 2.3: Update `app/api/reports/create/route.ts`**

At the top, add the import:

```typescript
import { logApiCall } from '@/lib/api/api-call-logger'
```

Delete the local `logApiCall` function (lines 390–413).

Replace the five call sites with the shared utility using named parameters:

**AutoDev success (was `logApiCall(report.id, 'autodev', '/vin', true, ...)`):**

```typescript
await logApiCall({
  reportId: report.id,
  provider: 'autodev',
  endpoint: '/vin/{vin}',
  success: true,
  responseTimeMs: Date.now() - startTime,
  cost: 0.0,
  requestData: { vin },
  responseData: {
    make: vehicleData.make,
    model: vehicleData.model,
    year: vehicleData.vehicle.year,
    vinValid: vehicleData.vinValid,
  },
})
```

**AutoDev failure:**

```typescript
await logApiCall({
  reportId: report.id,
  provider: 'autodev',
  endpoint: '/vin/{vin}',
  success: false,
  responseTimeMs: Date.now() - startTime,
  cost: 0.0,
  requestData: { vin },
  errorMessage: autoDevVinResult.error,
})
```

**MarketCheck success (was `logApiCall(report.id, 'marketcheck', '/predict/car/price', true, ..., 0.1, undefined)`):**

```typescript
await logApiCall({
  reportId: report.id,
  provider: 'marketcheck',
  endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
  success: true,
  responseTimeMs: Date.now() - marketCheckStartTime,
  cost: 0.09,
  requestData: { vin, mileage, zip_code: zipCode, dealer_type: dealerType },
  responseData: {
    predicted_price: marketcheckValuation!.predictedPrice,
    total_comparables_found: marketcheckValuation!.totalComparablesFound,
    recent_comparables_found: marketcheckValuation!.recentComparables?.num_found ?? 0,
  },
})
```

**MarketCheck failure:**

```typescript
await logApiCall({
  reportId: report.id,
  provider: 'marketcheck',
  endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
  success: false,
  responseTimeMs: Date.now() - marketCheckStartTime,
  cost: 0.0,
  requestData: { vin, mileage, zip_code: zipCode, dealer_type: dealerType },
  errorMessage: marketCheckResult.error,
})
```

**MarketCheck catch block:**

```typescript
await logApiCall({
  reportId: report.id,
  provider: 'marketcheck',
  endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
  success: false,
  responseTimeMs: Date.now() - marketCheckStartTime,
  cost: 0.0,
  requestData: { vin, mileage, zip_code: zipCode, dealer_type: dealerType },
  errorMessage: error instanceof Error ? error.message : 'Unknown error',
})
```

- [ ] **Step 2.4: Run tests to confirm they pass**

```bash
npx jest "__tests__/app/api/reports/create/route.test.ts" --no-coverage
```

Expected: PASS

- [ ] **Step 2.5: Run full test suite**

```bash
npm run test:ci
```

Expected: All tests pass

- [ ] **Step 2.6: Commit**

```bash
git add app/api/reports/create/route.ts __tests__/app/api/reports/create/route.test.ts
git commit -m "refactor: use shared logApiCall in reports/create, fix endpoint strings and cost"
```

---

## Chunk 3: Update `fetch-marketcheck` and `webhook` routes

### Task 3: Update `fetch-marketcheck/route.ts`

**Files:**

- Modify: `app/api/reports/[id]/fetch-marketcheck/route.ts`

**Context:** This file has four inline `supabase.from('api_call_logs').insert(...)` calls. The `supabase` variable at line 165 is used for both the report update and the MarketCheck log insert — after this change, the report update keeps using `createServerSupabaseClient()`, while the log insert moves to the shared utility. `vinValid` is already present in the AutoDev `responseData` here — no change needed. No existing test file covers this route's logging directly; the change is covered by the shared utility's own tests.

- [ ] **Step 3.1: Add import and replace the four inline inserts**

Add at top of file:

```typescript
import { logApiCall } from '@/lib/api/api-call-logger'
```

**Replace AutoDev success insert (lines ~127–141):**

```typescript
await logApiCall({
  reportId,
  provider: 'autodev',
  endpoint: '/vin/{vin}',
  success: true,
  responseTimeMs: vinResponseTime,
  cost: 0.0,
  requestData: { vin },
  responseData: {
    make: vinDecodeResult.data.make,
    model: vinDecodeResult.data.model,
    year: vinDecodeResult.data.vehicle?.year,
    vinValid: vinDecodeResult.data.vinValid,
  },
})
```

**Replace AutoDev failure insert (lines ~150–160):**

```typescript
await logApiCall({
  reportId,
  provider: 'autodev',
  endpoint: '/vin/{vin}',
  success: false,
  responseTimeMs: vinResponseTime,
  cost: 0.0,
  requestData: { vin },
  errorMessage: vinDecodeResult.error,
})
```

**Replace MarketCheck success insert (lines ~206–224):**

```typescript
await logApiCall({
  reportId,
  provider: 'marketcheck',
  endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
  success: true,
  responseTimeMs: apiResponseTime,
  cost: 0.09,
  requestData: { vin, mileage, zip_code, dealer_type: 'franchise' },
  responseData: {
    predicted_price: marketcheckResult.data.predictedPrice,
    total_comparables_found: marketcheckResult.data.totalComparablesFound,
    recent_comparables_found: marketcheckResult.data.recentComparables?.num_found ?? 0,
  },
})
```

**Replace MarketCheck failure insert (lines ~237–251):**

```typescript
await logApiCall({
  reportId,
  provider: 'marketcheck',
  endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
  success: false,
  responseTimeMs: apiResponseTime,
  cost: 0.0,
  requestData: { vin, mileage, zip_code, dealer_type: 'franchise' },
  errorMessage: marketcheckResult.error,
})
```

Note: The `supabase` variable declared from `createServerSupabaseClient()` at line 165 is still used for the `.from('reports').update(...)` call — do not remove it.

- [ ] **Step 3.2: Run full test suite**

```bash
npm run test:ci
```

Expected: All tests pass

- [ ] **Step 3.3: Commit**

```bash
git add "app/api/reports/[id]/fetch-marketcheck/route.ts"
git commit -m "refactor: use shared logApiCall in fetch-marketcheck route"
```

---

### Task 4: Update `webhook/route.ts`

**Files:**

- Modify: `app/api/lemonsqueezy/webhook/route.ts`
- Modify: `__tests__/app/api/lemonsqueezy/webhook/route.test.ts`

**Context:** Four inline inserts in the webhook's `handleOrderCreated` function. The two MarketCheck log calls are conditional — they must stay inside the `if (!marketcheckData)` block. AutoDev `responseData` is missing `vinValid`. MarketCheck success `responseData` is missing `recent_comparables_found`.

- [ ] **Step 4.1: Update webhook tests to assert the missing fields**

Open `__tests__/app/api/lemonsqueezy/webhook/route.test.ts`. Add a mock for the shared logger and add assertions:

```typescript
// At top of file, add:
jest.mock('@/lib/api/api-call-logger')
import { logApiCall } from '@/lib/api/api-call-logger'
const mockLogApiCall = logApiCall as jest.MockedFunction<typeof logApiCall>

// In test for successful order_created with MarketCheck fetch:
expect(mockLogApiCall).toHaveBeenCalledWith(
  expect.objectContaining({
    provider: 'autodev',
    responseData: expect.objectContaining({ vinValid: expect.any(Boolean) }),
  })
)
expect(mockLogApiCall).toHaveBeenCalledWith(
  expect.objectContaining({
    provider: 'marketcheck',
    responseData: expect.objectContaining({
      recent_comparables_found: expect.any(Number),
    }),
  })
)
```

- [ ] **Step 4.2: Run tests to confirm they fail**

```bash
npx jest "__tests__/app/api/lemonsqueezy/webhook/route.test.ts" --no-coverage
```

Expected: FAIL on the new assertions

- [ ] **Step 4.3: Add import and replace the four inline inserts**

Add at top of file:

```typescript
import { logApiCall } from '@/lib/api/api-call-logger'
```

**Replace MarketCheck success insert (inside `if (!marketcheckData)` block):**

```typescript
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
    dealer_type: 'franchise',
  },
  responseData: {
    predicted_price: mcResult.data.predictedPrice,
    total_comparables_found: mcResult.data.totalComparablesFound,
    recent_comparables_found: mcResult.data.recentComparables?.num_found ?? 0,
  },
})
```

**Replace MarketCheck failure insert (inside `if (!marketcheckData)` block):**

```typescript
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
    dealer_type: 'franchise',
  },
  errorMessage: mcResult.error,
})
```

**Replace AutoDev success insert:**

```typescript
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
```

**Replace AutoDev failure insert:**

```typescript
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
```

- [ ] **Step 4.4: Run tests to confirm they pass**

```bash
npx jest "__tests__/app/api/lemonsqueezy/webhook/route.test.ts" --no-coverage
```

Expected: PASS

- [ ] **Step 4.5: Run full test suite**

```bash
npm run test:ci
```

Expected: All tests pass

- [ ] **Step 4.6: Commit**

```bash
git add app/api/lemonsqueezy/webhook/route.ts __tests__/app/api/lemonsqueezy/webhook/route.test.ts
git commit -m "refactor: use shared logApiCall in webhook, add missing vinValid and recent_comparables_found"
```

---

### Task 5: Update `admin/reports/create-free/route.ts`

**Files:**

- Modify: `app/api/admin/reports/create-free/route.ts`
- Modify: `__tests__/app/api/admin/reports/create-free/route.test.ts`

**Context:** Two inline inserts. Both have wrong endpoint strings, wrong cost, and `response_time_ms: 0`. The `mcStartTime` variable must be declared **inside** the `if (vehicleData)` block, just before `fetchMarketCheckData`. The AutoDev result is in `autoDevResult` (`autoDevResult.data` is the `AutoDevVinDecodeData`). The MarketCheck result is in `mcResult`; `marketcheckValuation` holds the validated prediction.

- [ ] **Step 5.1: Update tests to assert correct timing and canonical fields**

Open `__tests__/app/api/admin/reports/create-free/route.test.ts`. Add a mock for the shared logger and add assertions:

```typescript
// At top of file, add:
jest.mock('@/lib/api/api-call-logger')
import { logApiCall } from '@/lib/api/api-call-logger'
const mockLogApiCall = logApiCall as jest.MockedFunction<typeof logApiCall>

// In test for successful free report creation, assert:
expect(mockLogApiCall).toHaveBeenCalledWith(
  expect.objectContaining({
    provider: 'autodev',
    endpoint: '/vin/{vin}',
    cost: 0.0,
    responseTimeMs: expect.any(Number),
  })
)
// Confirm response_time_ms is measured (not hardcoded 0)
const autoDevCall = mockLogApiCall.mock.calls.find(c => c[0].provider === 'autodev')
expect(autoDevCall![0].responseTimeMs).toBeGreaterThanOrEqual(0)

expect(mockLogApiCall).toHaveBeenCalledWith(
  expect.objectContaining({
    provider: 'marketcheck',
    endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
    cost: 0.09,
    responseData: expect.objectContaining({
      predicted_price: expect.any(Number),
      total_comparables_found: expect.any(Number),
      recent_comparables_found: expect.any(Number),
    }),
  })
)
```

- [ ] **Step 5.2: Run tests to confirm they fail**

```bash
npx jest "__tests__/app/api/admin/reports/create-free/route.test.ts" --no-coverage
```

Expected: FAIL on the new assertions

- [ ] **Step 5.3: Update `admin/reports/create-free/route.ts`**

Add import:

```typescript
import { logApiCall } from '@/lib/api/api-call-logger'
```

Before `fetchAutoDevVinDecode`, add:

```typescript
const autoDevStartTime = Date.now()
```

Replace the AutoDev inline insert:

```typescript
await logApiCall({
  reportId: report.id,
  provider: 'autodev',
  endpoint: '/vin/{vin}',
  success: autoDevResult.success,
  responseTimeMs: Date.now() - autoDevStartTime,
  cost: 0.0,
  requestData: { vin },
  responseData:
    autoDevResult.success && autoDevResult.data
      ? {
          make: autoDevResult.data.make,
          model: autoDevResult.data.model,
          year: autoDevResult.data.vehicle.year,
          vinValid: autoDevResult.data.vinValid,
        }
      : undefined,
  errorMessage: autoDevResult.success ? undefined : autoDevResult.error,
})
```

Inside the `if (vehicleData)` block, immediately before `fetchMarketCheckData`, add:

```typescript
const mcStartTime = Date.now()
```

Replace the MarketCheck inline insert (inside `if (vehicleData)`, after the `fetchMarketCheckData` call):

```typescript
await logApiCall({
  reportId: report.id,
  provider: 'marketcheck',
  endpoint: '/v2/predict/car/us/marketcheck_price/comparables',
  success: mcResult.success,
  responseTimeMs: Date.now() - mcStartTime,
  cost: mcResult.success ? 0.09 : 0.0,
  requestData: { vin, mileage, zip_code: zipCode, dealer_type: dealerType },
  responseData:
    mcResult.success && marketcheckValuation
      ? {
          predicted_price: marketcheckValuation.predictedPrice,
          total_comparables_found: marketcheckValuation.totalComparablesFound,
          recent_comparables_found: marketcheckValuation.recentComparables?.num_found ?? 0,
        }
      : undefined,
  errorMessage: mcResult.success ? undefined : mcResult.error,
})
```

- [ ] **Step 5.4: Run tests to confirm they pass**

```bash
npx jest "__tests__/app/api/admin/reports/create-free/route.test.ts" --no-coverage
```

Expected: PASS

- [ ] **Step 5.5: Run full test suite**

```bash
npm run test:ci
```

Expected: All tests pass

- [ ] **Step 5.6: Commit**

```bash
git add app/api/admin/reports/create-free/route.ts __tests__/app/api/admin/reports/create-free/route.test.ts
git commit -m "refactor: use shared logApiCall in create-free, fix timing, endpoint strings and cost"
```

---

## Chunk 4: Migrate `create-anonymous/route.ts`

### Task 6: Migrate VinAudit → Auto.dev, add logging

**Files:**

- Modify: `app/api/reports/create-anonymous/route.ts`
- Create: `__tests__/app/api/reports/create-anonymous/route.test.ts`

**Context:** This is the most substantial change. Current order: idempotency check → VIN decode (VinAudit) → DB insert. New order: idempotency check → DB insert (vehicle_data: null) → VIN decode (Auto.dev) → logApiCall → DB update with vehicle data. The local `VehicleData` interface (lines 22–32) becomes dead code and must be removed. The background `fetch(...)` to `/api/marketcheck/valuation` (lines ~209–224) must be removed.

Response shape: return the in-memory decoded vehicle data rather than reading from `report.vehicle_data` (which is null at insert time).

- [ ] **Step 6.1: Write tests for the migrated route**

Create `__tests__/app/api/reports/create-anonymous/route.test.ts`:

```typescript
import { POST } from '@/app/api/reports/create-anonymous/route'

jest.mock('@/lib/api/api-call-logger')
jest.mock('@/lib/api/autodev-client')
jest.mock('@/lib/db/supabase')

import { logApiCall } from '@/lib/api/api-call-logger'
import { fetchAutoDevVinDecode } from '@/lib/api/autodev-client'
import { supabaseAdmin } from '@/lib/db/supabase'

const mockLogApiCall = logApiCall as jest.MockedFunction<typeof logApiCall>
const mockFetchAutoDevVinDecode = fetchAutoDevVinDecode as jest.MockedFunction<
  typeof fetchAutoDevVinDecode
>

const mockInsert = jest.fn()
const mockUpdate = jest.fn()
const mockSelect = jest.fn()
const mockEq = jest.fn()
const mockOrder = jest.fn()
const mockLimit = jest.fn()
const mockMaybeSingle = jest.fn()
const mockSingle = jest.fn()

const mockAutoDevData = {
  vin: '1HGBH41JXMN109186',
  vinValid: true,
  wmi: '1HG',
  checkDigit: '6',
  checksum: true,
  origin: 'North America',
  make: 'Honda',
  model: 'Accord',
  trim: 'EX-L',
  body: 'Sedan',
  type: 'Gasoline',
  engine: '1.5L Turbo I4',
  drive: 'FWD',
  transmission: 'CVT',
  vehicle: { year: 2021 },
}

beforeEach(() => {
  jest.clearAllMocks()

  mockMaybeSingle.mockResolvedValue({ data: null, error: null }) // no duplicate
  mockSingle.mockResolvedValue({ data: { id: 'new-report-id' }, error: null })
  mockInsert.mockReturnValue({ select: jest.fn().mockReturnValue({ single: mockSingle }) })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockEq.mockResolvedValue({ data: null, error: null })
  mockSelect.mockReturnValue({
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: mockOrder,
  })
  mockOrder.mockReturnValue({ limit: mockLimit })
  mockLimit.mockReturnValue({ maybeSingle: mockMaybeSingle })
  ;(supabaseAdmin as any).from = jest.fn((table: string) => {
    if (table === 'reports') return { select: mockSelect, insert: mockInsert, update: mockUpdate }
    return { insert: jest.fn().mockResolvedValue({ data: null, error: null }) }
  })

  mockFetchAutoDevVinDecode.mockResolvedValue({ success: true, data: mockAutoDevData })
  mockLogApiCall.mockResolvedValue(undefined)
})

function makeRequest(body: object) {
  return new Request('http://localhost:3000/api/reports/create-anonymous', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

it('creates report, calls Auto.dev (not VinAudit), and logs the call', async () => {
  const response = await POST(
    makeRequest({ vin: '1HGBH41JXMN109186', mileage: 35000, zipCode: '10001' })
  )
  const data = await response.json()

  expect(response.status).toBe(200)
  expect(mockFetchAutoDevVinDecode).toHaveBeenCalledWith('1HGBH41JXMN109186')
  expect(mockLogApiCall).toHaveBeenCalledWith(
    expect.objectContaining({
      provider: 'autodev',
      endpoint: '/vin/{vin}',
      success: true,
      reportId: 'new-report-id',
      requestData: { vin: '1HGBH41JXMN109186' },
      responseData: expect.objectContaining({ make: 'Honda', vinValid: true }),
    })
  )
  // Response includes vehicle data from memory
  expect(data.report.vehicle_data).toMatchObject({ make: 'Honda', model: 'Accord' })
})

it('logs failure and continues when Auto.dev fails', async () => {
  mockFetchAutoDevVinDecode.mockResolvedValue({ success: false, error: 'timeout' })

  const response = await POST(
    makeRequest({ vin: '1HGBH41JXMN109186', mileage: 35000, zipCode: '10001' })
  )
  expect(response.status).toBe(200)
  expect(mockLogApiCall).toHaveBeenCalledWith(
    expect.objectContaining({
      provider: 'autodev',
      success: false,
      errorMessage: 'timeout',
    })
  )
})

it('does not call fetch() for marketcheck/valuation', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch')
  await POST(makeRequest({ vin: '1HGBH41JXMN109186', mileage: 35000, zipCode: '10001' }))
  const marketCheckCalls = fetchSpy.mock.calls.filter(c => String(c[0]).includes('marketcheck'))
  expect(marketCheckCalls).toHaveLength(0)
  fetchSpy.mockRestore()
})
```

- [ ] **Step 6.2: Run tests to confirm they fail**

```bash
npx jest "__tests__/app/api/reports/create-anonymous/route.test.ts" --no-coverage
```

Expected: FAIL — route still uses VinAudit, no `logApiCall` call

- [ ] **Step 6.3: Rewrite `create-anonymous/route.ts`**

Replace the file content, making these changes:

1. **Remove** the local `VehicleData` interface (lines 22–32).
2. **Add import** at top: `import { fetchAutoDevVinDecode, type AutoDevVinDecodeData } from '@/lib/api/autodev-client'`
3. **Add import** at top: `import { logApiCall } from '@/lib/api/api-call-logger'`
4. **Remove** the `CreateAnonymousReportRequest` interface's usage of `VehicleData` — the decoded data is now typed as `AutoDevVinDecodeData | null`.
5. **New execution order** in the `POST` handler — after the idempotency check and authentication check:

```typescript
// Step 1: Create report with null vehicle_data
const { data: report, error: insertError } = await supabase
  .from('reports')
  .insert({
    vin: sanitizedVin,
    mileage: mileageNum,
    zip_code: zipCode,
    email: normalizedEmail,
    dealer_type: 'private',
    status: 'pending',
    vehicle_data: null,
    user_id: authenticatedUserId,
  })
  .select()
  .single()

if (insertError || !report) {
  console.error('[create-anonymous] Database insert error:', insertError)
  return NextResponse.json({ error: 'Failed to create report. Please try again.' }, { status: 500 })
}

// Step 2: Decode VIN with Auto.dev
const vinStartTime = Date.now()
const vinDecodeResult = await fetchAutoDevVinDecode(sanitizedVin)
const vinResponseTime = Date.now() - vinStartTime

let vehicleData: AutoDevVinDecodeData | null = null

if (vinDecodeResult.success && vinDecodeResult.data) {
  vehicleData = vinDecodeResult.data

  await logApiCall({
    reportId: report.id,
    provider: 'autodev',
    endpoint: '/vin/{vin}',
    success: true,
    responseTimeMs: vinResponseTime,
    cost: 0.0,
    requestData: { vin: sanitizedVin },
    responseData: {
      make: vehicleData.make,
      model: vehicleData.model,
      year: vehicleData.vehicle.year,
      vinValid: vehicleData.vinValid,
    },
  })
} else {
  await logApiCall({
    reportId: report.id,
    provider: 'autodev',
    endpoint: '/vin/{vin}',
    success: false,
    responseTimeMs: vinResponseTime,
    cost: 0.0,
    requestData: { vin: sanitizedVin },
    errorMessage: vinDecodeResult.error,
  })
}

// Step 3: Update report with vehicle data (camelCase keys, matching create/route.ts)
if (vehicleData) {
  await supabase
    .from('reports')
    .update({
      vehicle_data: {
        year: vehicleData.vehicle.year.toString(),
        make: vehicleData.make,
        model: vehicleData.model,
        trim: vehicleData.trim,
        bodyType: vehicleData.body,
        engine: vehicleData.engine,
        transmission: vehicleData.transmission,
        driveType: vehicleData.drive,
        fuelType: vehicleData.type,
      },
    })
    .eq('id', report.id)
}

// Step 4: Return response (vehicle data from memory, not DB)
return NextResponse.json({
  success: true,
  report: {
    id: report.id,
    vin: report.vin,
    mileage: report.mileage,
    zip_code: report.zip_code,
    email: report.email,
    status: report.status,
    vehicle_data: vehicleData
      ? {
          year: vehicleData.vehicle.year.toString(),
          make: vehicleData.make,
          model: vehicleData.model,
          trim: vehicleData.trim,
          bodyType: vehicleData.body,
          engine: vehicleData.engine,
          transmission: vehicleData.transmission,
          driveType: vehicleData.drive,
          fuelType: vehicleData.type,
        }
      : null,
    marketcheck_valuation: null,
    created_at: report.created_at,
  },
})
```

Also **remove** the background `fetch(...)` call to `/api/marketcheck/valuation` (the block that fires after checking `vehicleData?.year && vehicleData?.make && vehicleData?.model`).

- [ ] **Step 6.4: Run tests to confirm they pass**

```bash
npx jest "__tests__/app/api/reports/create-anonymous/route.test.ts" --no-coverage
```

Expected: PASS — all 3 tests pass

- [ ] **Step 6.5: Run full test suite**

```bash
npm run test:ci
```

Expected: All tests pass

- [ ] **Step 6.6: Commit**

```bash
git add app/api/reports/create-anonymous/route.ts __tests__/app/api/reports/create-anonymous/route.test.ts
git commit -m "feat: migrate create-anonymous from VinAudit to Auto.dev, add api_call_logs logging"
```

---

## Chunk 5: Cleanup and Verification

### Task 7: Remove `VINAUDIT_API_KEY` references and type-check

**Files:**

- Modify: `.env.local` (if present)
- Search and remove all references to `VINAUDIT_API_KEY` and `vindecoder.p.rapidapi.com`

- [ ] **Step 7.1: Search for any remaining VinAudit references**

```bash
cd "../Vehicle Comparison Site"
grep -r "VINAUDIT_API_KEY\|vindecoder.p.rapidapi" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.env*" .
```

Expected: No matches (the migration removed the only usage).

- [ ] **Step 7.2: Remove from `.env.local` if present**

If `.env.local` contains `VINAUDIT_API_KEY=...`, delete that line.

- [ ] **Step 7.3: Run TypeScript type check**

```bash
npm run type-check
```

Expected: No type errors

- [ ] **Step 7.4: Run full test suite one final time**

```bash
npm run test:ci
```

Expected: All tests pass

- [ ] **Step 7.5: Commit**

```bash
git add -u
git commit -m "chore: remove VINAUDIT_API_KEY references after VinAudit migration"
```

- [ ] **Step 7.6: Push branch and open PR**

```bash
git push -u origin feat/consistent-api-call-logging
```

Then open a PR from `feat/consistent-api-call-logging` → `main` on GitHub. PR title: `refactor: consistent api_call_logs via shared logApiCall utility`.

Verify the Vercel preview deploys successfully before merging.
