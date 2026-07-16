# Vehicle Personalization for Abandoned Report Recovery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `%%VIN%%` in the Abandoned Report Recovery emails with a human-readable vehicle description ("2019 Honda Civic") by decoding the VIN via Auto.dev at report-submission time (not just post-payment), storing it as flat columns, and threading it through the recovery cron into Zoho Campaigns.

**Architecture:** Implements the approved-but-unbuilt `docs/superpowers/specs/2026-07-12-vin-decode-at-submission-design.md` spec (Tasks 1-5: new `vehicle_make`/`vehicle_model`/`vehicle_year` columns on `reports` and `leads`, `upsert_lead` extended, all three report-creation routes populate them), then extends it with the follow-up work that spec explicitly deferred (Tasks 6-7: wiring these fields into the Abandoned Report Recovery cron and Zoho templates). Auto.dev is called once per report at submission; its result populates both the existing `vehicle_data` JSONB blob (already expected by pre-existing tests on the anonymous route — see Task 3) and the new flat columns.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + supabase-js v2), Auto.dev VIN decode API, Zoho Campaigns REST API, Jest (node environment)

## Global Constraints

- Website root for all file paths below: `Vehicle Comparison Site/`
- **`upsert_lead` must stay a single function — never a new overload.** A prior migration that added a second overload broke PostgREST's RPC dispatch in production for weeks (`PGRST203`). Always `CREATE OR REPLACE` the one function, appending new params as trailing `DEFAULT NULL` args.
- **Auto.dev decode must always be non-fatal.** Report/lead creation must never fail because a VIN decode failed or Auto.dev was unreachable — log and continue with `null` vehicle fields.
- **Discovery during planning:** `__tests__/app/api/reports/create-anonymous/route.test.ts` already contains 2 failing (red) tests — `'creates report, calls Auto.dev (not VinAudit), and logs the call'` and `'logs failure and continues when Auto.dev fails'` — that expect this exact route to call `fetchAutoDevVinDecode`, populate `vehicle_data`, and call `logApiCall`. Someone started this work as a TDD red step before writing the formal design spec. Task 3 below satisfies these pre-existing tests directly rather than writing new ones from scratch — do not skip running them first.
- This plan **modifies the same cron enrollment block** as `docs/superpowers/plans/2026-07-13-abandoned-report-vin-locked-checkout.md` (Task 3, same `docs/superpowers/plans/` folder as this file). Task 6 here shows the full, merged enrollment block (recovery-token logic + vehicle description) — if that other plan hasn't been implemented yet, use Task 6's version directly instead of applying both plans' diffs separately.
- This plan depends on the not-yet-built N2 cron (`docs/superpowers/plans/2026-07-10-abandoned-report-recovery-emails.md`, which creates `app/api/cron/abandoned-report-recovery/route.ts` and `lib/zoho-campaigns.ts`). Implement N2 first.
- Do not implement this plan until the current single-code-entry version of the 3-email drip is built, live in Zoho, and running — deliberate fast-follow, not a launch blocker.

---

## Task 1: Schema — `vehicle_make`/`vehicle_model`/`vehicle_year` columns + `upsert_lead` extension

**Files:**

- Create: `supabase/migrations/20260713010000_add_vehicle_columns_and_lead_attribution.sql`

**Interfaces:**

- Produces: `reports.vehicle_make text`, `reports.vehicle_model text`, `reports.vehicle_year integer`; same three columns on `leads`; `upsert_lead(p_email, p_lead_type, p_source, p_kb_source_slug, p_utm_source, p_utm_medium, p_utm_campaign, p_vehicle_make, p_vehicle_model, p_vehicle_year)` (10-arg, replaces the current 7-arg function)

- [ ] **Step 1: Write the migration**

```sql
-- Migration: Decode VIN at submission time — flat vehicle columns
-- Date: 2026-07-13
-- Purpose: Make year/make/model available for ALL reports (paid or not) at
--          submission time, so nurture emails can personalize by vehicle
--          instead of only VIN. See docs/superpowers/specs/2026-07-12-vin-decode-at-submission-design.md.
-- IMPORTANT: upsert_lead is CREATE OR REPLACE'd here, never a new overload —
--            see 20260710180000_fix_upsert_lead_overload_ambiguity.sql for why
--            a second overload previously broke PostgREST RPC dispatch in prod.

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS vehicle_make text,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS vehicle_year integer;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS vehicle_make text,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS vehicle_year integer;

CREATE OR REPLACE FUNCTION public.upsert_lead(
  p_email text,
  p_lead_type text,
  p_source text DEFAULT NULL,
  p_kb_source_slug text DEFAULT NULL,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_vehicle_make text DEFAULT NULL,
  p_vehicle_model text DEFAULT NULL,
  p_vehicle_year integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_type     TEXT;
  v_existing_priority INT;
  v_new_priority      INT;
BEGIN
  v_new_priority := CASE p_lead_type
    WHEN 'dispute_letter'  THEN 1
    WHEN 'form_submitted'  THEN 2
    WHEN 'purchased'       THEN 3
    ELSE 0
  END;

  SELECT lead_type INTO v_existing_type
  FROM public.leads
  WHERE email = p_email;

  IF NOT FOUND THEN
    INSERT INTO public.leads (
      email, lead_type, source, kb_source_slug, utm_source, utm_medium, utm_campaign,
      vehicle_make, vehicle_model, vehicle_year
    )
    VALUES (
      p_email, p_lead_type, p_source, p_kb_source_slug, p_utm_source, p_utm_medium, p_utm_campaign,
      p_vehicle_make, p_vehicle_model, p_vehicle_year
    )
    ON CONFLICT (email) DO NOTHING;
  ELSE
    v_existing_priority := CASE v_existing_type
      WHEN 'dispute_letter'  THEN 1
      WHEN 'form_submitted'  THEN 2
      WHEN 'purchased'       THEN 3
      ELSE 0
    END;

    UPDATE public.leads
      SET lead_type      = CASE WHEN v_new_priority > v_existing_priority THEN p_lead_type ELSE lead_type END,
          updated_at     = CASE WHEN v_new_priority > v_existing_priority THEN NOW() ELSE updated_at END,
          source         = COALESCE(source, p_source),
          kb_source_slug = COALESCE(kb_source_slug, p_kb_source_slug),
          utm_source     = COALESCE(utm_source, p_utm_source),
          utm_medium     = COALESCE(utm_medium, p_utm_medium),
          utm_campaign   = COALESCE(utm_campaign, p_utm_campaign),
          vehicle_make   = COALESCE(vehicle_make, p_vehicle_make),
          vehicle_model  = COALESCE(vehicle_model, p_vehicle_model),
          vehicle_year   = COALESCE(vehicle_year, p_vehicle_year)
      WHERE email = p_email;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_lead(text, text, text, text, text, text, text, text, text, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Apply the migration**

Run in the Supabase SQL editor (`https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/sql`).

- [ ] **Step 3: Verify**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name IN ('reports', 'leads') AND column_name IN ('vehicle_make', 'vehicle_model', 'vehicle_year');
-- Expect 6 rows

SELECT proname, pronargs FROM pg_proc WHERE proname = 'upsert_lead';
-- Expect exactly 1 row, pronargs = 10
```

- [ ] **Step 4: Commit**

```bash
git add "Vehicle Comparison Site/supabase/migrations/20260713010000_add_vehicle_columns_and_lead_attribution.sql"
git commit -m "feat: add vehicle_make/model/year columns and extend upsert_lead"
```

---

## Task 2: `lib/leads.ts` — thread vehicle attribution through `upsertLead`

**Files:**

- Modify: `lib/leads.ts`
- Modify: `__tests__/lib/leads.test.ts`

**Interfaces:**

- Produces: `LeadAttribution` gains `vehicleMake?: string`, `vehicleModel?: string`, `vehicleYear?: number`; `upsertLead(supabase, email, leadType, attribution?)` now also forwards `p_vehicle_make`/`p_vehicle_model`/`p_vehicle_year`

- [ ] **Step 1: Write the failing test**

Add to `__tests__/lib/leads.test.ts` (after the existing tests, same file/pattern):

```ts
it('forwards vehicle attribution to the upsert_lead RPC', async () => {
  const supabase = makeSupabase()
  await upsertLead(supabase, 'user@example.com', 'form_submitted', {
    vehicleMake: 'Honda',
    vehicleModel: 'Accord',
    vehicleYear: 2021,
  })
  expect(supabase.rpc).toHaveBeenCalledWith('upsert_lead', {
    p_email: 'user@example.com',
    p_lead_type: 'form_submitted',
    p_source: undefined,
    p_kb_source_slug: undefined,
    p_utm_source: undefined,
    p_utm_medium: undefined,
    p_utm_campaign: undefined,
    p_vehicle_make: 'Honda',
    p_vehicle_model: 'Accord',
    p_vehicle_year: 2021,
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- __tests__/lib/leads.test.ts
```

Expected: FAIL — actual call object has no `p_vehicle_make`/`p_vehicle_model`/`p_vehicle_year` keys.

- [ ] **Step 3: Implement**

`lib/leads.ts` — full updated file:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type LeadType = 'dispute_letter' | 'form_submitted' | 'purchased'

export interface LeadAttribution {
  source?: string
  kbSourceSlug?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  vehicleMake?: string
  vehicleModel?: string
  vehicleYear?: number
}

export async function upsertLead(
  supabase: SupabaseClient,
  email: string,
  leadType: LeadType,
  attribution?: LeadAttribution
): Promise<void> {
  const { error } = await supabase.rpc('upsert_lead', {
    p_email: email,
    p_lead_type: leadType,
    p_source: attribution?.source,
    p_kb_source_slug: attribution?.kbSourceSlug,
    p_utm_source: attribution?.utmSource,
    p_utm_medium: attribution?.utmMedium,
    p_utm_campaign: attribution?.utmCampaign,
    p_vehicle_make: attribution?.vehicleMake,
    p_vehicle_model: attribution?.vehicleModel,
    p_vehicle_year: attribution?.vehicleYear,
  })
  if (error) {
    throw new Error(`[leads] upsert_lead RPC failed: ${error.message}`)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/lib/leads.test.ts
```

Expected: PASS, all tests including the pre-existing 2-key exact-match test (Jest's `toEqual` ignores `undefined`-valued keys, so the new always-present `p_vehicle_*: undefined` keys don't break it).

- [ ] **Step 5: Commit**

```bash
git add "Vehicle Comparison Site/lib/leads.ts" "Vehicle Comparison Site/__tests__/lib/leads.test.ts"
git commit -m "feat: thread vehicle attribution through upsertLead"
```

---

## Task 3: `create-anonymous` route — decode at submission, populate `vehicle_data` + flat columns

**Files:**

- Modify: `app/api/reports/create-anonymous/route.ts`
- Modify: `__tests__/app/api/reports/create-anonymous/route.test.ts`

**Interfaces:**

- Consumes: `fetchAutoDevVinDecode(vin: string): Promise<{ success: boolean; data?: AutoDevVinDecodeData; error?: string }>` from `@/lib/api/autodev-client` (unchanged)
- Consumes: `logApiCall(params: { reportId?: string; provider: 'autodev' | 'marketcheck' | 'webhook'; endpoint: string; success: boolean; responseTimeMs?: number; cost?: number; requestData?: Record<string, unknown>; responseData?: Record<string, unknown>; errorMessage?: string }): Promise<void>` from `@/lib/api/api-call-logger` (unchanged)
- Consumes: `upsertLead(supabase, email, leadType, attribution?)` from `@/lib/leads` — `attribution` now accepts `vehicleMake`/`vehicleModel`/`vehicleYear` (Task 2)

- [ ] **Step 1: Run the pre-existing failing tests to confirm current red state**

```bash
npm test -- __tests__/app/api/reports/create-anonymous/route.test.ts
```

Expected: FAIL — 2 tests fail (`toHaveBeenCalledWith` on `mockFetchAutoDevVinDecode` and `mockLogApiCall`, 0 calls). 8 other tests in this file currently pass and must keep passing.

- [ ] **Step 2: Update the two lead-attribution tests that will change shape**

In `__tests__/app/api/reports/create-anonymous/route.test.ts`, `describe('Lead capture', ...)` and `describe('attribution (N5)', ...)` blocks assert exact `rpc` call objects. Since `mockFetchAutoDevVinDecode` resolves successfully with `mockAutoDevData` (`make: 'Honda'`, `model: 'Accord'`, `vehicle: { year: 2021 }`) by default in `beforeEach`, the vehicle fields will now be **defined**, not `undefined` — so these two tests need the new fields added or they'll fail (Jest only ignores `undefined`-valued keys, not defined ones):

Replace the assertion at line ~150-153 (`'calls upsert_lead RPC with form_submitted when email is provided'`):

```ts
expect((supabaseAdmin as any).rpc).toHaveBeenCalledWith('upsert_lead', {
  p_email: 'user@example.com',
  p_lead_type: 'form_submitted',
  p_vehicle_make: 'Honda',
  p_vehicle_model: 'Accord',
  p_vehicle_year: 2021,
})
```

Replace the assertion at line ~236-244 (`'passes source and kbSourceSlug into upsertLead when an email is provided'`):

```ts
expect((supabaseAdmin as any).rpc).toHaveBeenCalledWith('upsert_lead', {
  p_email: 'shopper@example.com',
  p_lead_type: 'form_submitted',
  p_source: 'kb_article',
  p_kb_source_slug: 'pennsylvania-total-loss-law',
  p_utm_source: undefined,
  p_utm_medium: undefined,
  p_utm_campaign: undefined,
  p_vehicle_make: 'Honda',
  p_vehicle_model: 'Accord',
  p_vehicle_year: 2021,
})
```

- [ ] **Step 3: Add tests for the flat-column population and decode-failure fallback**

Add to the same file, in a new `describe` block:

```ts
describe('vehicle personalization (flat columns)', () => {
  it('sets vehicle_make/model/year on the reports insert when decode succeeds', async () => {
    await POST(makeRequest({ vin: '1HGBH41JXMN109186', mileage: 35000, zipCode: '10001' }))
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicle_make: 'Honda',
        vehicle_model: 'Accord',
        vehicle_year: 2021,
      })
    )
  })

  it('leaves vehicle_make/model/year null on the insert when decode fails', async () => {
    mockFetchAutoDevVinDecode.mockResolvedValue({ success: false, error: 'timeout' })
    const response = await POST(
      makeRequest({ vin: '1HGBH41JXMN109186', mileage: 35000, zipCode: '10001' })
    )
    expect(response.status).toBe(200)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicle_make: null,
        vehicle_model: null,
        vehicle_year: null,
      })
    )
  })
})
```

- [ ] **Step 4: Run to confirm all new/updated tests fail for the right reason**

```bash
npm test -- __tests__/app/api/reports/create-anonymous/route.test.ts
```

Expected: FAIL — up to 6 tests now red (2 pre-existing + 2 updated + 2 new).

- [ ] **Step 5: Implement the route changes**

`app/api/reports/create-anonymous/route.ts` — add these imports near the top (after the existing `upsertLead` import):

```ts
import { fetchAutoDevVinDecode } from '@/lib/api/autodev-client'
import { logApiCall } from '@/lib/api/api-call-logger'
```

Insert this block immediately after the existing `console.log('[create-anonymous] No recent duplicate found. Creating new report.')` line, **before** the authenticated-user check block:

```ts
console.log('[create-anonymous] No recent duplicate found. Creating new report.')

// Decode VIN via Auto.dev at submission time so vehicle info exists even
// for reports that never complete payment (Auto.dev is free-tier — see
// docs/superpowers/specs/2026-07-12-vin-decode-at-submission-design.md).
// Non-fatal: a failed/unreachable decode must never block report creation.
// logApiCall fires after the insert below, once report.id is known.
const decodeStartTime = Date.now()
const autoDevResult = await fetchAutoDevVinDecode(sanitizedVin)

let vehicleDataForInsert: Record<string, unknown> | null = null
let vehicleMake: string | null = null
let vehicleModel: string | null = null
let vehicleYear: number | null = null

if (autoDevResult.success && autoDevResult.data) {
  const decoded = autoDevResult.data
  vehicleMake = decoded.make
  vehicleModel = decoded.model
  vehicleYear = decoded.vehicle.year
  vehicleDataForInsert = {
    vin: sanitizedVin,
    mileage: mileageNum,
    zipCode,
    year: decoded.vehicle.year.toString(),
    make: decoded.make,
    model: decoded.model,
    trim: decoded.trim,
  }
}
```

Modify the `insert()` call to add `vehicle_data`, `vehicle_make`, `vehicle_model`, `vehicle_year` (replacing the existing `vehicle_data: null` line):

```ts
const { data: report, error: insertError } = await supabase
  .from('reports')
  .insert({
    vin: sanitizedVin,
    mileage: mileageNum,
    zip_code: zipCode,
    email: normalizedEmail,
    dealer_type: 'private',
    status: 'pending',
    vehicle_data: vehicleDataForInsert,
    vehicle_make: vehicleMake,
    vehicle_model: vehicleModel,
    vehicle_year: vehicleYear,
    user_id: authenticatedUserId,
    source: source ?? null,
    kb_source_slug: kbSourceSlug ?? null,
    ...(isAnonymous
      ? { access_token: accessToken, access_token_expires_at: accessTokenExpiresAt }
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({} as any)),
  })
  .select()
  .single()
```

Immediately after the existing `insertError` check block (once `report.id` is guaranteed to exist), add:

```ts
// Log the Auto.dev call now that we have a report id to attach it to
if (autoDevResult.success && autoDevResult.data) {
  await logApiCall({
    reportId: report.id,
    provider: 'autodev',
    endpoint: '/vin/{vin}',
    success: true,
    responseTimeMs: Date.now() - decodeStartTime,
    cost: 0.0,
    requestData: { vin: sanitizedVin },
    responseData: {
      make: autoDevResult.data.make,
      model: autoDevResult.data.model,
      year: autoDevResult.data.vehicle.year,
      vinValid: autoDevResult.data.vinValid,
    },
  })
} else {
  await logApiCall({
    reportId: report.id,
    provider: 'autodev',
    endpoint: '/vin/{vin}',
    success: false,
    responseTimeMs: Date.now() - decodeStartTime,
    cost: 0.0,
    requestData: { vin: sanitizedVin },
    errorMessage: autoDevResult.error,
  })
}
```

Modify the existing lead-capture block to pass vehicle attribution through:

```ts
// Capture form_submitted lead — non-fatal
if (normalizedEmail) {
  try {
    await upsertLead(supabaseAdmin, normalizedEmail, 'form_submitted', {
      source,
      kbSourceSlug,
      vehicleMake: vehicleMake ?? undefined,
      vehicleModel: vehicleModel ?? undefined,
      vehicleYear: vehicleYear ?? undefined,
    })
  } catch (leadErr) {
    console.error('[create-anonymous] Lead capture failed (non-fatal):', leadErr)
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- __tests__/app/api/reports/create-anonymous/route.test.ts
```

Expected: PASS, all 14 tests (10 original + 4 new/updated).

- [ ] **Step 7: Commit**

```bash
git add "Vehicle Comparison Site/app/api/reports/create-anonymous/route.ts" "Vehicle Comparison Site/__tests__/app/api/reports/create-anonymous/route.test.ts"
git commit -m "feat: decode VIN at submission and populate vehicle_data + flat columns"
```

---

## Task 4: `create` route (authenticated flow) — add flat columns to the existing update

**Files:**

- Modify: `app/api/reports/create/route.ts`
- Modify: `__tests__/app/api/reports/create/route.test.ts`

**Interfaces:**

- No new interfaces — `fetchAutoDevVinDecode` is already called at line 161; this task only adds 3 columns to the write that already happens at the `.update()` call starting at line 330.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/app/api/reports/create/route.test.ts` (top-level `describe`, using the same `mockUpdate` pattern already used at line 618-652 for `comparables_supplemented`):

```ts
it('writes vehicle_make/model/year to the report update when decode succeeds', async () => {
  const mockUpdate = jest.fn().mockReturnThis()
  const mockEq = jest.fn().mockResolvedValue({ error: null })
  mockSupabase.from = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: mockEq,
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: { id: 'test-report-123' }, error: null }),
    insert: jest.fn().mockReturnThis(),
    update: mockUpdate,
  })

  const request = new Request('http://localhost:3000/api/reports/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vin: '1HGBH41JXMN109186',
      mileage: 35000,
      zipCode: '10001',
      reportType: 'basic',
    }),
  })

  await POST(request)

  expect(mockUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      vehicle_make: 'Honda',
      vehicle_model: 'Accord',
      vehicle_year: 2021,
    })
  )
})
```

(This reuses whatever `mockFetchAutoDevVinDecode` default resolution is already set up earlier in the file — confirm it resolves `{ success: true, data: { make: 'Honda', model: 'Accord', vehicle: { year: 2021 }, ... } }`; if the existing default mock uses different values, match those instead of `'Honda'`/`'Accord'`/`2021`.)

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- __tests__/app/api/reports/create/route.test.ts -t "vehicle_make/model/year"
```

Expected: FAIL — `vehicle_make`/`vehicle_model`/`vehicle_year` absent from the update payload.

- [ ] **Step 3: Implement**

In `app/api/reports/create/route.ts`, the `.update({...})` call starting at line 330 gets 3 new keys added to its scalar tail (near the existing `mileage`/`zip_code`/`dealer_type` block at lines 403-406):

```ts
        mileage: mileage,
        zip_code: zipCode,
        dealer_type: dealerType,
        vehicle_make: vehicleData?.make ?? null,
        vehicle_model: vehicleData?.model ?? null,
        vehicle_year: vehicleData?.vehicle.year ?? null,
        data_retrieval_status: vehicleData ? 'completed' : 'failed',
      })
      .eq('id', report.id)
```

(`vehicleData` here is the existing `AutoDevVinDecodeData | null` local variable already set at line 164-166 from `autoDevVinResult` — no new variable needed.)

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/app/api/reports/create/route.test.ts
```

Expected: PASS, full suite including the new test.

- [ ] **Step 5: Commit**

```bash
git add "Vehicle Comparison Site/app/api/reports/create/route.ts" "Vehicle Comparison Site/__tests__/app/api/reports/create/route.test.ts"
git commit -m "feat: write vehicle_make/model/year on authenticated report creation"
```

---

## Task 5: `create-free` route (admin flow) — add flat columns to the existing update

**Files:**

- Modify: `app/api/admin/reports/create-free/route.ts`
- Modify: `__tests__/app/api/admin/reports/create-free/route.test.ts`

**Interfaces:**

- No new interfaces — `fetchAutoDevVinDecode` is already called at line 81; this task only adds 3 columns to the write that already happens at the `.update()` call starting at line 179.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/app/api/admin/reports/create-free/route.test.ts`, using the file's existing `jest.mock('@/lib/db/supabase', () => ({ supabaseAdmin: { from: jest.fn(), rpc: jest.fn() } }))` factory mock:

```ts
it('writes vehicle_make/model/year to the report update when decode succeeds', async () => {
  const mockUpdate = jest.fn().mockReturnThis()
  const mockEq = jest.fn().mockResolvedValue({ error: null })
  ;(supabaseAdmin.from as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: mockEq,
    single: jest.fn().mockResolvedValue({ data: { id: 'free-report-1' }, error: null }),
    insert: jest.fn().mockReturnThis(),
    update: mockUpdate,
  })
  ;(fetchAutoDevVinDecode as jest.Mock).mockResolvedValue({
    success: true,
    data: { make: 'Honda', model: 'Accord', vehicle: { year: 2021 } },
  })

  const request = new Request('http://localhost:3000/api/admin/reports/create-free', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vin: '1HGBH41JXMN109186', mileage: 35000, zipCode: '10001' }),
  })

  await POST(request)

  expect(mockUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      vehicle_make: 'Honda',
      vehicle_model: 'Accord',
      vehicle_year: 2021,
    })
  )
})
```

(Adjust the request body / any required admin auth headers to match whatever the surrounding tests in this file already set up — this route may require an admin session/header not shown here; copy that setup from an existing passing test in the same file.)

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- __tests__/app/api/admin/reports/create-free/route.test.ts -t "vehicle_make/model/year"
```

Expected: FAIL — keys absent from the update payload.

- [ ] **Step 3: Implement**

In `app/api/admin/reports/create-free/route.ts`, the `.update({...})` call starting at line 179 gets the same 3 keys added near its existing scalar tail (lines 229-234):

```ts
        marketcheck_fallback_used: marketcheckFallbackUsed,
        comparables_supplemented: comparablesSupplemented,
        mileage,
        zip_code: zipCode,
        dealer_type: dealerType,
        vehicle_make: vehicleData?.make ?? null,
        vehicle_model: vehicleData?.model ?? null,
        vehicle_year: vehicleData?.vehicle.year ?? null,
        data_retrieval_status: vehicleData ? 'completed' : 'failed',
      })
      .eq('id', report.id)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/app/api/admin/reports/create-free/route.test.ts
```

Expected: PASS, full suite including the new test.

- [ ] **Step 5: Commit**

```bash
git add "Vehicle Comparison Site/app/api/admin/reports/create-free/route.ts" "Vehicle Comparison Site/__tests__/app/api/admin/reports/create-free/route.test.ts"
git commit -m "feat: write vehicle_make/model/year on admin free-report creation"
```

---

## Task 6: Cron enrollment — send a vehicle description to Zoho instead of just VIN

**Files:**

- Modify: `app/api/cron/abandoned-report-recovery/route.ts` (created by the N2 plan — see Global Constraints)
- Modify: `__tests__/app/api/cron/abandoned-report-recovery/route.test.ts` (same origin)

**Interfaces:**

- Consumes: `addContactToList(params: { listKey: string; email: string; customFields?: Record<string, string> }): Promise<void>` from `@/lib/zoho-campaigns` (unchanged)
- Produces: `customFields.VehicleDescription` — `"2019 Honda Civic"` when `vehicle_year`/`vehicle_make`/`vehicle_model` are all present, else the literal fallback string `"your vehicle"` (never blank, so email copy can reference `%%VehicleDescription%%` unconditionally)

- [ ] **Step 1: Update the enrollment test**

In `__tests__/app/api/cron/abandoned-report-recovery/route.test.ts`, update the report fixture and assertion:

```ts
it('enrolls an eligible report with a vehicle description built from decoded fields', async () => {
  const report = {
    id: 'report-1',
    email: 'user@example.com',
    vin: '1HGBH41JXMN109186',
    vehicle_year: 2019,
    vehicle_make: 'Honda',
    vehicle_model: 'Civic',
    price_paid: null,
    abandoned_recovery_sent_at: null,
  }
  mockFrom.mockImplementation(() => ({ ...makeQueryChain([report]), update: mockUpdate }))

  const { GET } = await import('@/app/api/cron/abandoned-report-recovery/route')
  const res = await GET(makeRequest())

  expect(res.status).toBe(200)
  expect(mockAddContactToList).toHaveBeenCalledWith({
    listKey: 'abandoned-list-key',
    email: 'user@example.com',
    customFields: expect.objectContaining({
      VIN: '1HGBH41JXMN109186',
      VehicleDescription: '2019 Honda Civic',
    }),
  })
})

it('falls back to a generic vehicle description when decode data is missing', async () => {
  const report = {
    id: 'report-2',
    email: 'nodata@example.com',
    vin: '1HGCM82633A004352',
    vehicle_year: null,
    vehicle_make: null,
    vehicle_model: null,
    price_paid: null,
    abandoned_recovery_sent_at: null,
  }
  mockFrom.mockImplementation(() => ({ ...makeQueryChain([report]), update: mockUpdate }))

  const { GET } = await import('@/app/api/cron/abandoned-report-recovery/route')
  await GET(makeRequest())

  expect(mockAddContactToList).toHaveBeenCalledWith(
    expect.objectContaining({
      customFields: expect.objectContaining({ VehicleDescription: 'your vehicle' }),
    })
  )
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- __tests__/app/api/cron/abandoned-report-recovery/route.test.ts
```

Expected: FAIL — `customFields` has no `VehicleDescription` key yet; report `.select()` doesn't fetch the new columns.

- [ ] **Step 3: Update the query and enrollment loop**

Change the `.select(...)` call (originally `.select('id, email, vin')`) to:

```ts
    .select('id, email, vin, vehicle_year, vehicle_make, vehicle_model')
```

Replace the per-report enrollment body with:

```ts
const vehicleDescription =
  report.vehicle_year && report.vehicle_make && report.vehicle_model
    ? `${report.vehicle_year} ${report.vehicle_make} ${report.vehicle_model}`
    : 'your vehicle'

try {
  await addContactToList({
    listKey,
    email: report.email,
    customFields: {
      VIN: report.vin ?? '',
      VehicleDescription: vehicleDescription,
    },
  })
  await supabaseAdmin
    .from('reports')
    .update({ abandoned_recovery_sent_at: new Date().toISOString() })
    .eq('id', report.id)
  enrolled++
} catch (err) {
  console.error('[abandoned-report-recovery] Enrollment failed for report', report.id, err)
}
```

(If `docs/superpowers/plans/2026-07-13-abandoned-report-vin-locked-checkout.md` has already been implemented, merge this with its version of the same block instead — that plan additionally generates `recovery_token`/`recovery_token_expires_at` and sends `ResumeURL`/`ResumeURLDiscount`. The combined block sends `VIN`, `VehicleDescription`, `ResumeURL`, and `ResumeURLDiscount` together, and the `.update(...)` call sets `abandoned_recovery_sent_at`, `recovery_token`, and `recovery_token_expires_at` together.)

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/app/api/cron/abandoned-report-recovery/route.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "Vehicle Comparison Site/app/api/cron/abandoned-report-recovery/route.ts" "Vehicle Comparison Site/__tests__/app/api/cron/abandoned-report-recovery/route.test.ts"
git commit -m "feat: send vehicle description to Zoho instead of VIN-only"
```

---

## Task 7: Zoho Campaigns field + email copy update (manual, no automated test)

**Files:**

- Modify: `docs/zoho-campaigns-manual-setup.md` (totallosstoolkit-workspace repo) — Section B.2
- Modify: `docs/email-campaigns/abandoned-report-recovery.md` (totallosstoolkit-workspace repo) — all three email bodies

- [ ] **Step 1:** In Zoho Campaigns → **Contacts → Lists → Abandoned Report Recovery → Settings → Fields**, add one new custom text field: `VehicleDescription`. (Keep the existing `VIN` field — still useful for internal reference even though copy no longer displays it.)

- [ ] **Step 2:** In each of the 3 "Send Email" steps, replace the VIN mention with the new merge tag. In `docs/email-campaigns/abandoned-report-recovery.md`, change:
  - Email 1: `You started a report for a vehicle with VIN <strong>%%VIN%%</strong> a little while ago` → `You started a report for your <strong>%%VehicleDescription%%</strong> a little while ago`
  - Email 2: `Still thinking about finishing your report for VIN <strong>%%VIN%%</strong>?` → `Still thinking about finishing your report for your <strong>%%VehicleDescription%%</strong>?`
  - Email 3: `Last email from us about the report you started for VIN <strong>%%VIN%%</strong>.` → `Last email from us about the report you started for your <strong>%%VehicleDescription%%</strong>.`

- [ ] **Step 3:** Copy the updated HTML into the corresponding Zoho "Send Email" steps.

- [ ] **Step 4:** Send yourself a live test through the automation and confirm the vehicle description renders correctly for a report with decoded vehicle data, and renders `"your vehicle"` (not a blank or literal `%%VehicleDescription%%`) for a report where decode failed or the report predates this migration (existing rows have `vehicle_year`/`vehicle_make`/`vehicle_model` all `NULL`).

- [ ] **Step 5: Commit the doc changes**

```bash
git add docs/zoho-campaigns-manual-setup.md docs/email-campaigns/abandoned-report-recovery.md
git commit -m "docs: personalize abandoned-report-recovery emails by vehicle instead of VIN"
```

---

## Self-Review Notes

- **Spec coverage:** Tasks 1-5 implement all of `docs/superpowers/specs/2026-07-12-vin-decode-at-submission-design.md`'s "Design" section (schema, `upsert_lead`, all 3 call sites) exactly as specified. Tasks 6-7 implement the spec's explicitly-deferred "wiring these fields into Zoho Campaigns" non-goal.
- **Existing red tests:** Confirmed by actually running the suite during planning (not assumed) — `create-anonymous/route.test.ts` has 2 pre-existing failing tests this plan resolves as a side effect of Task 3, rather than needing separate new tests for that behavior.
- **Backward compatibility:** Existing paid reports created before this migration have `vehicle_year`/`vehicle_make`/`vehicle_model` all `NULL` — Task 6's fallback (`'your vehicle'`) and Task 4/5's non-fatal `?? null` handling both account for this; no backfill migration is in scope (out of scope — could be a fast-follow if backfilling old rows via the existing `autodev_vin_data` JSONB is later judged worthwhile).
- **Cross-plan dependency:** Flagged explicitly in Global Constraints and again inline in Task 6 Step 3 — this plan and the resume-checkout plan both edit the same cron file's enrollment block; whoever implements second should merge, not overwrite.
