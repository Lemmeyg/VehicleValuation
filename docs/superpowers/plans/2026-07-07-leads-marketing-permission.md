# Leads `marketing_permission` Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `marketing_permission` column to `public.leads`, defaulted to `true` for all existing and future rows, covering all four lead-capture entry points with a single additive migration.

**Architecture:** One new SQL migration file. No application code changes — the `NOT NULL DEFAULT true` column definition handles backfill and all future inserts through the existing `upsert_lead()` function without modification.

**Tech Stack:** Postgres (Supabase), applied manually via the Supabase dashboard SQL editor (no Supabase CLI in this environment).

## Global Constraints

- `marketing_permission` applies to ALL lead types (`dispute_letter`, `form_submitted`, `purchased`) — confirmed business decision, not to be second-guessed during implementation.
- Do not modify `lib/leads.ts`, the `upsert_lead()` function, or any of its 4 call sites — the column default is sufficient.
- Design spec: `docs/superpowers/specs/2026-07-07-leads-marketing-permission-design.md`

---

### Task 1: Add the migration

**Files:**

- Create: `supabase/migrations/20260707000000_add_leads_marketing_permission.sql`

**Interfaces:**

- Consumes: existing `public.leads` table (from `20260606000000_create_leads_table.sql`, `20260622000000_update_leads_schema.sql`)
- Produces: `marketing_permission BOOLEAN NOT NULL DEFAULT true` column, readable by any future code (e.g. Brevo drip-campaign export) via `SELECT marketing_permission FROM public.leads`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260707000000_add_leads_marketing_permission.sql`:

```sql
-- Adds marketing_permission to the leads table. All captured leads (dispute
-- letter downloads, form submissions, purchases) are marked as
-- marketing-permitted per current business decision — see
-- docs/superpowers/specs/2026-07-07-leads-marketing-permission-design.md.
-- NOT NULL DEFAULT true backfills all existing rows in the same statement.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS marketing_permission BOOLEAN NOT NULL DEFAULT true;
```

- [ ] **Step 2: Apply the migration manually**

The Supabase CLI is not available in this environment (see workspace `CLAUDE.md`). Apply via the dashboard SQL editor:

1. Open `https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/sql`
2. Paste the contents of the migration file above
3. Run it
4. Confirm no errors are returned

- [ ] **Step 3: Verify backfill and defaults**

Run in the same SQL editor:

```sql
SELECT email, lead_type, marketing_permission FROM public.leads LIMIT 20;
```

Expected: every existing row shows `marketing_permission = true`.

- [ ] **Step 4: Verify new inserts pick up the default**

Trigger one real lead-capture (e.g. submit a test email through `/dispute-letter` on the dev/preview site), then re-run:

```sql
SELECT email, lead_type, marketing_permission
FROM public.leads
ORDER BY created_at DESC
LIMIT 1;
```

Expected: the new row also has `marketing_permission = true`.

- [ ] **Step 5: Commit the migration file**

```bash
git add supabase/migrations/20260707000000_add_leads_marketing_permission.sql
git commit -m "feat: add marketing_permission column to leads table"
```

---

### Task 2: Close the loop with the backlog

**Files:** `backlog.md` (repo root)

- [ ] **Step 1: Mark both backlog lines as done**

Remove or check off these two lines in `backlog.md` (repo root of this workspace, not the site repo):

- "set marketing permission column value to yes when updating the leads table."
- "note marketing permission in the table based on the submission from the user in the report form"

- [ ] **Step 2: Commit**

```bash
git add backlog.md
git commit -m "chore: mark leads marketing_permission backlog items done"
```
