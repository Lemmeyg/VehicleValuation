# VIN Decode at Submission — Design

**Date:** 2026-07-12
**Status:** Approved, ready for implementation plan

## Problem

Vehicle make/model/year is only decoded from a VIN _after_ payment succeeds (in the LemonSqueezy webhook), and only stored inside a JSONB blob (`autodev_vin_data`) — never as flat, queryable columns, and never on the `leads` table at all.

Confirmed against live data (10 most recent `reports` rows via Supabase REST):

- Every `pending` (unpaid) report has `vehicle_data = NULL` and `autodev_vin_data = NULL` — **zero vehicle info captured for anyone who doesn't finish paying.**
- Even `completed` (paid) reports have `vehicle_data = NULL` — only `autodev_vin_data` gets populated by the webhook; `vehicle_data` is effectively dead despite code comments claiming otherwise.

This blocks using make/year/model to personalize nurture emails (the driving use case — see `docs/superpowers/plans/2026-07-07-zoho-campaigns-lead-nurture.md`) for the large share of visitors who submit the form but never pay.

## Goal

Decode the VIN via Auto.dev (the free-tier decoder already integrated — every call is logged with `cost: 0.0` in `api_call_logs`, vs. MarketCheck's ~$0.09/call) at report-submission time, regardless of purchase outcome, and store make/model/year as three dedicated columns on both `reports` and `leads`.

## Non-goals

- Not touching the LemonSqueezy webhook's existing post-payment Auto.dev call — that call remains responsible for the fuller `autodev_vin_data`/`vehicle_data` needed for PDF generation. This spec's decode is additive, not a replacement.
- Not wiring these fields into Zoho Campaigns / any nurture-email template — that's separate follow-up work once the data exists.
- Not adding server-side email validation to `create-anonymous` — email is enforced client-side only (see below); server-side stays optional as today, and non-fatal handling covers the no-email case.

## Existing behavior confirmed relevant to this design

- **VIN decoder in use:** `lib/api/autodev-client.ts` → `fetchAutoDevVinDecode(vin)` calls `https://api.auto.dev/vin/{vin}`, returns `{ success, data?: AutoDevVinDecodeData, error?, statusCode }` where `data.make`, `data.model`, `data.vehicle.year` are the fields needed.
- **Email is required client-side, optional server-side.** PR #79 (`0a1e46a`) made email required and validated in the three submission forms (`Hero.tsx`, `ArticleReportBar.tsx`, `VehicleValuation.tsx`), but `create-anonymous/route.ts` never re-validates it server-side (defense-in-depth gap, out of scope here). In practice, essentially every real submission through the UI carries an email; the API's existing non-fatal `if (normalizedEmail)` block already handles the rare case where it's absent.
- **`upsert_lead` Postgres function history:** a prior migration added new parameters via a second function overload, which broke PostgREST's RPC dispatch in production for weeks (`PGRST203`, silently swallowed by callers' non-fatal try/catch). The fix (`20260710180000_fix_upsert_lead_overload_ambiguity.sql`) was to keep exactly one `upsert_lead` function and add new params as trailing `DEFAULT NULL` args via `CREATE OR REPLACE`. **This design must follow the same rule: no new overload, ever.**

## Design

### 1. Schema (new migration)

```sql
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS vehicle_make text,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS vehicle_year integer;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS vehicle_make text,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS vehicle_year integer;
```

Named `vehicle_make`/`vehicle_model`/`vehicle_year` to match the self-describing column naming already in use (`marketcheck_valuation`, `autodev_vin_data`, `kb_source_slug`), and to avoid ambiguity with generic terms like "model."

Applied manually via the Supabase dashboard SQL editor, per this project's existing convention (no Supabase CLI in this environment).

### 2. `upsert_lead` function extension

`CREATE OR REPLACE` the existing single function (never a second overload), adding three trailing params:

```sql
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
-- same structure as today: INSERT ... ON CONFLICT DO NOTHING for new leads;
-- for existing leads, COALESCE(existing, new) on vehicle_make/model/year
-- (first-known value wins, same rule already applied to source/utm_*)
$$;

GRANT EXECUTE ON FUNCTION public.upsert_lead(text, text, text, text, text, text, text, text, text, integer) TO service_role;
```

`lib/leads.ts`:

- `LeadAttribution` interface gains `vehicleMake?: string`, `vehicleModel?: string`, `vehicleYear?: number`.
- `upsertLead(...)` passes these through as `p_vehicle_make`/`p_vehicle_model`/`p_vehicle_year` in the existing `.rpc('upsert_lead', {...})` call.

### 3. Decode call sites

Add the decode + column population to **all three report-creation routes** (consistent data regardless of creation path):

- **`app/api/reports/create-anonymous/route.ts`** (primary funnel): call `fetchAutoDevVinDecode(sanitizedVin)` right after the idempotency check (avoids a wasted API call on rapid duplicate submits) and before the `insert()`. Include `vehicle_make`/`vehicle_model`/`vehicle_year` directly in that same insert. Pass the same three values into the existing `upsertLead(...)` call inside the `if (normalizedEmail)` block.
- **`app/api/reports/create/route.ts`** (authenticated flow): decode already happens here (`fetchAutoDevVinDecode` at line 161) — just add the 3 columns to the report update that already writes `vehicleData` fields.
- **`app/api/admin/reports/create-free/route.ts`** (admin $0 flow): same pattern — decode already happens, add the 3 columns to whatever write already stores the decoded data.

### 4. Error handling

Non-fatal everywhere, matching the existing lead-capture try/catch pattern already in each route: if decode fails (VIN not found, Auto.dev unreachable, etc.), log the error and leave the 3 columns `null`. Report/lead creation must never fail because of a bad or unreachable VIN decode.

### 5. Testing

Update existing test files (no new test infrastructure needed):

- `__tests__/app/api/reports/create-anonymous/route.test.ts` — assert `vehicle_make`/`vehicle_model`/`vehicle_year` are set on the insert payload and passed to `upsertLead`, and that a decode failure still results in a successful report creation with `null` values.
- `__tests__/app/api/reports/create/route.test.ts`, `__tests__/app/api/admin/reports/create-free/route.test.ts` — same assertions for their respective write path.
- `__tests__/lib/leads.test.ts` — assert new params are forwarded to the RPC call.

## Open items for the implementation plan

- Exact line-level diff for `create/route.ts` and `create-free/route.ts` (where their existing decoded-data write happens) needs to be located precisely during planning — not fully pinned down in this design.
- Confirm whether `logApiCall` (used in `create/route.ts` for Auto.dev cost tracking) should also be called from `create-anonymous/route.ts` for parity — not required by this spec's goal, but low-cost to add for observability consistency. Decide during planning.
