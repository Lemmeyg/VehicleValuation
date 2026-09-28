-- Report Delivery & QA Gate (docs/Inbox/report-delivery-prd.md §15)
-- Apply manually in the Supabase SQL editor per repo convention — this repo has
-- no Supabase CLI. Skip must run this before any build-step-3+ code that writes
-- these columns reaches production.

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_status_check CHECK (status IN (
  'draft','pending','completed','failed','vin_decode_failed','valuation_failed',
  'needs_review','refunded'));

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS progress_step text,            -- comps | listings | valuation | pdf
  ADD COLUMN IF NOT EXISTS qa_results jsonb,              -- [{key,label,passed,detail}]
  ADD COLUMN IF NOT EXISTS qa_failed_checks text[],
  ADD COLUMN IF NOT EXISTS qa_evaluated_at timestamptz,
  ADD COLUMN IF NOT EXISTS build_ms integer,              -- paid_at → release, for tracking
  ADD COLUMN IF NOT EXISTS review_email_enrolled_at timestamptz;

CREATE INDEX IF NOT EXISTS reports_status_paid_at_idx ON public.reports (status, paid_at);
NOTIFY pgrst, 'reload schema';
