-- Migration: Persist the state/vehicle-year personalization links on reports
-- Date: 2026-07-29
-- Purpose: The Abandoned Report Recovery cron already computes StateArticleURL/
--          StateName/VehicleGuideURL on every run and sends them to Zoho; this
--          persists the same three values on the reports row for admin
--          visibility/debugging. Not read back by the cron itself.

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS state_article_url text,
  ADD COLUMN IF NOT EXISTS state_name text,
  ADD COLUMN IF NOT EXISTS vehicle_guide_url text;
