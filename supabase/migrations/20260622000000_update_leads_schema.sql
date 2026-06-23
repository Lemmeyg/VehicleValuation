-- Migration: update leads table to single-row-per-email with lead_type priority
-- Apply manually via Supabase dashboard SQL editor:
-- https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/sql

-- Step 1: Add new columns (nullable initially to avoid constraint errors on existing rows)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_type TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Step 2: Migrate existing source values to lead_type
UPDATE public.leads
SET lead_type = CASE
  WHEN source = 'dispute-letter' THEN 'dispute_letter'
  ELSE 'form_submitted'
END;

-- Step 3: Deduplicate — keep only the highest-priority row per email.
-- If the same email appears as both 'dispute_letter' and 'form_submitted',
-- delete the lower-priority one.
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY email
      ORDER BY
        CASE lead_type
          WHEN 'purchased'       THEN 3
          WHEN 'form_submitted'  THEN 2
          WHEN 'dispute_letter'  THEN 1
          ELSE 0
        END DESC,
        created_at DESC
    ) AS rn
  FROM public.leads
)
DELETE FROM public.leads
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 4: Make lead_type NOT NULL and add check constraint
ALTER TABLE public.leads
  ALTER COLUMN lead_type SET NOT NULL,
  ADD CONSTRAINT leads_lead_type_check
    CHECK (lead_type IN ('dispute_letter', 'form_submitted', 'purchased'));

-- Step 5: Drop old constraint and source column
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_email_source_unique;
ALTER TABLE public.leads DROP COLUMN IF EXISTS source;

-- Step 6: Add unique constraint on email only
ALTER TABLE public.leads ADD CONSTRAINT leads_email_unique UNIQUE (email);

-- Step 7: Add email index for fast lookups (unique constraint creates one automatically,
-- but keep the source index drop explicit)
DROP INDEX IF EXISTS idx_leads_source;

-- Step 8: Create the priority-aware upsert function
CREATE OR REPLACE FUNCTION public.upsert_lead(p_email TEXT, p_lead_type TEXT)
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
    INSERT INTO public.leads (email, lead_type)
    VALUES (p_email, p_lead_type);
  ELSE
    v_existing_priority := CASE v_existing_type
      WHEN 'dispute_letter'  THEN 1
      WHEN 'form_submitted'  THEN 2
      WHEN 'purchased'       THEN 3
      ELSE 0
    END;

    IF v_new_priority > v_existing_priority THEN
      UPDATE public.leads
        SET lead_type  = p_lead_type,
            updated_at = NOW()
        WHERE email = p_email;
    END IF;
  END IF;
END;
$$;

-- Step 9: Grant execute to service_role (used by supabaseAdmin in the API routes)
GRANT EXECUTE ON FUNCTION public.upsert_lead(TEXT, TEXT) TO service_role;
