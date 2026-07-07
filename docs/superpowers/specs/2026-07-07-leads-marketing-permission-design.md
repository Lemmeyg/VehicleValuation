# Design: `marketing_permission` Column on `leads` Table

**Date:** 2026-07-07
**Backlog ref:** "set marketing permission column value to yes when updating the leads table" (Critical/Engineering); "note marketing permission in the table based on the submission from the user in the report form" (Marketing)

## Context

The `public.leads` table (created in `20260606000000_create_leads_table.sql`, reshaped in `20260622000000_update_leads_schema.sql`) captures one row per email with a priority-ranked `lead_type` (`dispute_letter` < `form_submitted` < `purchased`), written via the `upsert_lead(p_email, p_lead_type)` Postgres function and the `upsertLead()` wrapper in `lib/leads.ts`. Four call sites feed it today:

- `app/api/dispute-letter/route.ts:45` — `'dispute_letter'`
- `app/api/reports/create-anonymous/route.ts:182` — `'form_submitted'`
- `app/api/leads/capture/route.ts:44` — `'form_submitted'`
- `app/api/lemonsqueezy/webhook/route.ts:188` — `'purchased'`

There is no `marketing_permission` column today, and no consent checkbox in any of the forms feeding these routes.

**Decision (confirmed with user):** `marketing_permission` applies to all lead types — dispute-letter downloads, form submissions, and purchases all count as marketing-permitted. This is a deliberate, narrower scope than the still-open "Marketing and emailing permissions and legal statement" backlog item, which will formalize actual consent language/UI later; this task does not block on that.

## Approach

Add the column with a `NOT NULL DEFAULT true`. In Postgres, adding a column this way in a single `ALTER TABLE` statement backfills every existing row to `true` in the same operation — no separate `UPDATE` needed, and no changes to `upsert_lead()` or `lib/leads.ts`, since every current and future code path should always end up with `true` and nothing ever sets it back to `false`.

## Change

New migration file: `supabase/migrations/20260707000000_add_leads_marketing_permission.sql`

```sql
-- Adds marketing_permission to the leads table. All captured leads (dispute
-- letter downloads, form submissions, purchases) are marked as
-- marketing-permitted per current business decision — see
-- docs/superpowers/specs/2026-07-07-leads-marketing-permission-design.md.
-- NOT NULL DEFAULT true backfills all existing rows in the same statement.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS marketing_permission BOOLEAN NOT NULL DEFAULT true;
```

Per `supabase/README.md` / workspace `CLAUDE.md`, the Supabase CLI is not available in this environment — apply manually via the Supabase dashboard SQL editor (`https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/sql`), same as the prior leads migration.

## Out of scope

- No changes to `lib/leads.ts`, `upsert_lead()`, or any of the 4 call sites — the column default handles every path.
- No consent checkbox / UI changes — tracked separately under "Marketing and emailing permissions and legal statement."
- No email-campaign tooling changes — this only prepares the data column for later use (e.g. by the Brevo drip-campaign work in the backlog).

## Testing

- No application code changes, so no Jest coverage needed.
- Manual verification after applying: run `SELECT email, lead_type, marketing_permission FROM public.leads LIMIT 20;` in the Supabase SQL editor and confirm all rows show `true`. Then submit one new dispute-letter download and confirm the new row also has `marketing_permission = true`.

## Risks

Low — additive column with a backfilling default, no application code touches it. The only real risk is compliance-related (marking dispute-letter-only leads as marketing-permitted without an explicit checkbox), which is a deliberate, confirmed business decision for this task, not an engineering risk.
