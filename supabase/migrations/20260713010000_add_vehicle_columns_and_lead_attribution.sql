-- Migration: Decode VIN at submission time — flat vehicle columns
-- Date: 2026-07-13
-- Purpose: Make year/make/model available for ALL reports (paid or not) at
--          submission time, so nurture emails can personalize by vehicle
--          instead of only VIN. See docs/superpowers/specs/2026-07-12-vin-decode-at-submission-design.md.
-- IMPORTANT: upsert_lead signature changes from 7 args to 10 args. The old 7-arg
--            version is dropped explicitly before CREATE OR REPLACE, for the same
--            reason as 20260710180000_fix_upsert_lead_overload_ambiguity.sql:
--            CREATE OR REPLACE with different arity creates a new overload, not a
--            replacement. Multiple overloads break PostgREST's function dispatch
--            (PGRST203). See that migration for full incident context.

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS vehicle_make text,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS vehicle_year integer;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS vehicle_make text,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS vehicle_year integer;

DROP FUNCTION IF EXISTS public.upsert_lead(text, text, text, text, text, text, text);

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
