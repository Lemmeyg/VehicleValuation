-- BL-125: connect the emailed-PDF download back to the person who bought the report.
--
-- The report-delivery email links to /api/reports/download/[token], which is fetched
-- by the browser straight from our server. No client-side PostHog code runs on that
-- request, so the server has no way to know which PostHog person is downloading —
-- unless we recorded their id earlier. This column stores the visitor's PostHog
-- distinct_id, captured by the VIN entry form at report creation, so the server-side
-- report_downloaded event can be attributed to the same person who visited pricing
-- and checked out. Without it the download lands on a throwaway anonymous person and
-- the checkout -> download funnel cannot be computed.
--
-- Nullable by design: reports created before this migration, by the admin tools, or
-- by a visitor with analytics blocked simply have no id, and the download route
-- falls back to an anonymous capture rather than failing.

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS posthog_distinct_id TEXT DEFAULT NULL;

COMMENT ON COLUMN public.reports.posthog_distinct_id IS
  'PostHog distinct_id of the visitor who created this report, captured client-side at submission. Used to attribute the server-side report_downloaded event fired by /api/reports/download/[token] to the correct person. Nullable.';

NOTIFY pgrst, 'reload schema';
