# Design: Consistent API Call Logging

**Date:** 2026-03-14
**Status:** Approved
**Scope:** Centralise `api_call_logs` writes into a shared utility; migrate `create-anonymous` from VinAudit to Auto.dev; fix logging gaps in all four external-API route handlers.

---

## Problem

External API calls (Auto.dev VIN decode, MarketCheck price prediction) are logged to the `api_call_logs` Supabase table, but inconsistently:

- The logging logic is duplicated inline across four route files with slightly different implementations.
- `admin/reports/create-free` hardcodes `response_time_ms: 0`, uses wrong endpoint strings, wrong cost values, and omits `request_data`/`response_data`.
- `reports/create` uses a local `logApiCall` helper with wrong endpoint strings, wrong cost values, and missing `request_data`/`response_data` for AutoDev and MarketCheck.
- `reports/create-anonymous` makes an external VinAudit (RapidAPI) call with no logging at all, uses a different API provider from all other routes, and fires a dead background fetch to a non-existent `/api/marketcheck/valuation` endpoint.

---

## Goals

1. One shared `logApiCall` utility — no inline logging duplication.
2. Consistent fields logged on every call: provider, endpoint, success, response time, cost, request data, response data (summary), error message.
3. `create-anonymous` migrated from VinAudit to Auto.dev for provider consistency.
4. All route files updated to use the shared utility with canonical values.
5. Dead background MarketCheck call in `create-anonymous` removed.
6. `VINAUDIT_API_KEY` env var deprecated.

---

## Non-Goals

- Storing full API response payloads (already saved to `reports` table columns).
- Changing the `api_call_logs` table schema.
- Adding logging to non-external-API routes (auth, articles, suppliers, etc.).

---

## Architecture

### New File: `lib/api/api-call-logger.ts`

Single exported async function using a named-parameter object:

```ts
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

export async function logApiCall(params: LogApiCallParams): Promise<void>
```

**Implementation requirements:**

- `reportId` is required (non-nullable) — all call sites must have a report ID before calling this function.
- Uses `supabaseAdmin` (service role) — works in all contexts (authenticated routes, webhook, admin routes).
- The DB column is `api_provider` (not `provider`). The utility must map `params.provider` → `api_provider` in the insert object.
- Supabase JS client v2 never throws — it returns `{ data, error }`. The utility must check the returned `error` object and call `console.error` if it is set. Additionally wrap the whole function in `try/catch` to guard against unexpected exceptions. Never re-throw — logging failure must not break the API response.
- `requestData` and `responseData` are written to `request_data` and `response_data` columns respectively.

Example insert object:

```ts
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
if (error) console.error('[logApiCall] Failed to insert api_call_logs:', error)
```

---

## Canonical Field Values

All routes must use these exact values. No exceptions.

### Endpoint strings

| Provider    | Canonical value                                      |
| ----------- | ---------------------------------------------------- |
| AutoDev     | `'/vin/{vin}'`                                       |
| MarketCheck | `'/v2/predict/car/us/marketcheck_price/comparables'` |

### Cost values

| Provider    | Success | Failure |
| ----------- | ------- | ------- |
| AutoDev     | `0.00`  | `0.00`  |
| MarketCheck | `0.09`  | `0.00`  |

### Request data

| Provider    | `requestData` fields                                                      |
| ----------- | ------------------------------------------------------------------------- |
| AutoDev     | `{ vin: string }`                                                         |
| MarketCheck | `{ vin: string, mileage: number, zip_code: string, dealer_type: string }` |

Note: In `fetch-marketcheck/route.ts`, there is no computed `dealerType` variable. Use the hardcoded string `'franchise'` as the `dealer_type` value for that file specifically.

### Response data (success only; pass `undefined` on failure so it writes as `null`)

| Provider    | `responseData` fields                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| AutoDev     | `{ make, model, year, vinValid }` — all four fields required                                         |
| MarketCheck | `{ predicted_price, total_comparables_found, recent_comparables_found }` — all three fields required |

All routes must log exactly these shapes.

---

## Route Changes

### `app/api/reports/create/route.ts`

**Wrong values to fix:**

- AutoDev endpoint: `'/vin'` → `'/vin/{vin}'`
- MarketCheck endpoint: `'/predict/car/price'` → `'/v2/predict/car/us/marketcheck_price/comparables'`
- MarketCheck success cost: `0.1` → `0.09`

**Changes:**

- Delete the local `logApiCall` function (lines 390–413).
- Import `logApiCall` from `lib/api/api-call-logger.ts`.
- Update **all three** existing call sites to the named-parameter shape:
  1. AutoDev success (line ~155): add `requestData: { vin }`, `responseData: { make, model, year, vinValid }`.
  2. AutoDev failure (line ~160): add `requestData: { vin }`, omit `responseData`.
  3. MarketCheck success (line ~226): add `requestData: { vin, mileage, zipCode as zip_code, dealer_type: dealerType }`, `responseData: { predicted_price: marketcheckValuation.predictedPrice, total_comparables_found: marketcheckValuation.totalComparablesFound, recent_comparables_found: marketcheckValuation.recentComparables?.num_found ?? 0 }`.
  4. MarketCheck failure (line ~243): add `requestData: { vin, mileage, zipCode as zip_code, dealer_type: dealerType }`, omit `responseData`.
  5. MarketCheck catch block (line ~262): add `requestData: { vin, mileage, zipCode as zip_code, dealer_type: dealerType }`, omit `responseData`.

### `app/api/reports/[id]/fetch-marketcheck/route.ts`

**Changes:**

- Replace all inline `supabase.from('api_call_logs').insert(...)` blocks with `logApiCall` calls.
- In this file, some `createServerSupabaseClient()` calls are used for both report updates and log inserts. After the change, log inserts move to `supabaseAdmin` via the shared utility. The `supabase` variable from `createServerSupabaseClient()` at line 165 is used for the report update (`.from('reports').update(...)`) — keep that call on `createServerSupabaseClient()`, only the log insert moves to the shared utility.
- `vinValid` is already present in the AutoDev `responseData` (line 136–140) — no change needed.
- Use hardcoded `'franchise'` for `dealer_type` in MarketCheck `requestData`.

### `app/api/lemonsqueezy/webhook/route.ts`

**Changes:**

- Replace all inline `supabase.from('api_call_logs').insert(...)` blocks with `logApiCall` calls.
- The MarketCheck log calls are conditional (only fire when `marketcheckData` was not already cached). Keep both `logApiCall` calls **inside the same conditional block** — do not move them outside.
- AutoDev `responseData`: add `vinValid` (currently logs `{ make, model, year }` — must be `{ make, model, year, vinValid }`).
- MarketCheck success `responseData`: add `recent_comparables_found` (currently logs `{ predicted_price, total_comparables_found }` — must include all three canonical fields).

### `app/api/admin/reports/create-free/route.ts`

**Wrong values to fix:**

- AutoDev endpoint: `'/vin'` → `'/vin/{vin}'`
- MarketCheck endpoint: `'/predict/car/price'` → `'/v2/predict/car/us/marketcheck_price/comparables'`
- MarketCheck success cost: `0.1` → `0.09`
- AutoDev `response_time_ms`: `0` → measured time

**Changes:**

- Add `const autoDevStartTime = Date.now()` immediately before `fetchAutoDevVinDecode` call; pass `Date.now() - autoDevStartTime` as `responseTimeMs`.
- Add `const mcStartTime = Date.now()` **inside** the `if (vehicleData)` block, immediately before `fetchMarketCheckData`; pass `Date.now() - mcStartTime` as `responseTimeMs`.
- Replace two inline insert blocks with `logApiCall` calls using canonical `requestData` and `responseData`.
- AutoDev `requestData: { vin }`, `responseData: { make: vehicleData.make, model: vehicleData.model, year: vehicleData.vehicle.year, vinValid: vehicleData.vinValid }` on success.
- MarketCheck `requestData: { vin, mileage, zip_code: zipCode, dealer_type: dealerType }`, `responseData: { predicted_price, total_comparables_found, recent_comparables_found }` on success.

### `app/api/reports/create-anonymous/route.ts`

**Execution order change (required for `reportId` availability):**

The current code decodes VIN (line 144) then creates the report (line 175). Reverse this order:

1. Create the report first (insert with `vehicle_data: null`, `dealer_type: 'private'`, `status: 'pending'`) — preserving all existing insert fields.
2. Call `fetchAutoDevVinDecode` with `sanitizedVin`.
3. Call `logApiCall` with the available `reportId`.
4. Update the report with the decoded vehicle data (or leave `vehicle_data: null` if decode failed).

**Remove the local `VehicleData` interface** (lines 22–32) — it was purpose-built for VinAudit's snake_case response shape and becomes dead code.

**Migration: VinAudit → Auto.dev**

Remove the entire VinAudit `fetch()` block (lines 144–172). Import `fetchAutoDevVinDecode` from `lib/api/autodev-client.ts`.

Map the AutoDev response to `vehicle_data` using **camelCase keys** to match `create/route.ts`:

| `vehicle_data` DB key | Source in `AutoDevVinDecodeData` |
| --------------------- | -------------------------------- |
| `year`                | `data.vehicle.year.toString()`   |
| `make`                | `data.make`                      |
| `model`               | `data.model`                     |
| `trim`                | `data.trim`                      |
| `bodyType`            | `data.body`                      |
| `engine`              | `data.engine`                    |
| `transmission`        | `data.transmission`              |
| `driveType`           | `data.drive`                     |
| `fuelType`            | `data.type`                      |

Note: The current code stores snake_case keys (`body_style`, `drive_type`, `fuel_type`). Switching to camelCase aligns with all other routes. No downstream code reading these snake_case keys from anonymous reports was found.

If `fetchAutoDevVinDecode` fails, `vehicle_data` remains `null` in the DB. The route continues normally.

**API response after migration:**

The success response at the end of the route returns `vehicle_data: report.vehicle_data`. After reordering, the initial insert has `vehicle_data: null`, but the report is updated with vehicle data after the VIN decode. To return vehicle data in the response without a re-fetch, pass the decoded vehicle data object in the response directly from memory (same pattern as `create/route.ts`), rather than reading from `report.vehicle_data`.

The idempotency path (lines 97–117) already returns `vehicle_data: null` — this behaviour is unchanged and acceptable (the caller will get vehicle data when the report is later viewed).

**Dead background call removal**

Remove the `fetch(...)` call to `/api/marketcheck/valuation` (lines 209–224). This endpoint does not exist. MarketCheck runs later in the webhook after payment.

**Add logging**

Add `logApiCall` for AutoDev success and failure cases after the report insert (so `reportId` is available). No MarketCheck logging in this route.

---

## Error Handling

- `logApiCall` never throws (see Architecture section).
- If VIN decode fails in `create-anonymous`, the route logs the failure and continues with `vehicle_data: null`.
- Timing measured with `Date.now()` before and after each API call, passed explicitly to `logApiCall`.

---

## Environment Variable Cleanup

- Remove `VINAUDIT_API_KEY` from `.env.local` (if present).
- Remove `VINAUDIT_API_KEY` from Vercel project environment settings.
- Remove all references to `VINAUDIT_API_KEY` and `vindecoder.p.rapidapi.com` from code and documentation.

---

## Files Affected

| File                                              | Change                                                                                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `lib/api/api-call-logger.ts`                      | **New** — shared utility                                                                                                           |
| `app/api/reports/create/route.ts`                 | Remove local helper, fix endpoint strings and cost, use shared utility, add missing fields to all 5 call sites                     |
| `app/api/reports/[id]/fetch-marketcheck/route.ts` | Replace inline inserts with shared utility                                                                                         |
| `app/api/lemonsqueezy/webhook/route.ts`           | Replace inline inserts with shared utility, keep conditional, add `vinValid` and `recent_comparables_found`                        |
| `app/api/admin/reports/create-free/route.ts`      | Replace inline inserts, fix endpoint strings, cost, timing, add request/response data                                              |
| `app/api/reports/create-anonymous/route.ts`       | Reorder (create report first), remove VehicleData interface, migrate VinAudit → Auto.dev, remove dead background call, add logging |

---

## Testing

For each route, verify rows in `api_call_logs`:

**AutoDev rows:**

- `api_provider = 'autodev'`
- `endpoint = '/vin/{vin}'`
- `cost = 0.00`
- `response_time_ms > 0`
- `request_data = {"vin": "<value>"}`
- `response_data` contains `make`, `model`, `year`, `vinValid` on success
- `response_data` is `null` on failure; `error_message` is populated

**MarketCheck rows:**

- `api_provider = 'marketcheck'`
- `endpoint = '/v2/predict/car/us/marketcheck_price/comparables'`
- `cost = 0.09` on success, `0.00` on failure
- `response_time_ms > 0`
- `request_data` contains `vin`, `mileage`, `zip_code`, `dealer_type`
- `response_data` contains `predicted_price`, `total_comparables_found`, `recent_comparables_found` on success
- `response_data` is `null` on failure

**All rows:**

- `report_id` is non-null

**`create-anonymous` specific:**

- Verify no outbound calls to `vindecoder.p.rapidapi.com` or `/api/marketcheck/valuation`

**Environment:**

- Confirm `VINAUDIT_API_KEY` removed from `.env.local` and Vercel
