-- Adds persisted attribution columns to leads and reports (source, KB slug,
-- UTM params) so attribution captured client-side in PostHog is also
-- queryable in Postgres — required for recovery/nurture email targeting. See
-- docs/superpowers/specs/2026-07-07-post-payment-ideal-experience-design.md
-- Section 1.3. The reports columns are consumed by
-- 2026-07-08-server-side-anonymous-report-creation.md (N5), not by this plan.
--
-- Apply manually via the Supabase dashboard SQL editor:
-- https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/sql

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS kb_source_slug text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text;

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS kb_source_slug text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text;

-- Replace upsert_lead: same lead_type priority logic as before, plus
-- first-touch attribution columns. COALESCE(existing, new) means a value
-- already recorded is never overwritten by a later call — the origin
-- channel is what matters for recovery/nurture targeting, not the most
-- recent touch.
CREATE OR REPLACE FUNCTION public.upsert_lead(
  p_email text,
  p_lead_type text,
  p_source text DEFAULT NULL,
  p_kb_source_slug text DEFAULT NULL,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL
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
    INSERT INTO public.leads (email, lead_type, source, kb_source_slug, utm_source, utm_medium, utm_campaign)
    VALUES (p_email, p_lead_type, p_source, p_kb_source_slug, p_utm_source, p_utm_medium, p_utm_campaign)
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
          utm_campaign   = COALESCE(utm_campaign, p_utm_campaign)
      WHERE email = p_email;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_lead(text, text, text, text, text, text, text) TO service_role;
