-- Creates the leads table for capturing email addresses from lead magnets
-- (dispute letter, future downloads). Used by /api/dispute-letter route.

CREATE TABLE IF NOT EXISTS public.leads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  source     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leads_email_source_unique UNIQUE (email, source)
);

-- Index for fast lookups by source (e.g. filtering by 'dispute-letter')
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads (source);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads (created_at DESC);

-- Enable RLS — service role key (used by the API route) bypasses this automatically
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- No public read access — leads are admin-only
CREATE POLICY "Service role can read leads"
  ON public.leads
  FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can insert leads"
  ON public.leads
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update leads"
  ON public.leads
  FOR UPDATE
  USING (auth.role() = 'service_role');
