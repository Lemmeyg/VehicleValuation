-- =====================================================
-- Add LemonSqueezy Payment ID Fields
-- =====================================================
-- This migration adds lemon_squeezy_payment_id columns to
-- support LemonSqueezy as the primary payment processor.
--
-- Stripe columns are marked as deprecated but kept for
-- historical data.
-- =====================================================

-- Add lemon_squeezy_payment_id to reports table
ALTER TABLE public.reports
ADD COLUMN IF NOT EXISTS lemon_squeezy_payment_id TEXT;

-- Add lemon_squeezy_payment_id to payments table
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS lemon_squeezy_payment_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reports_lemon_squeezy_payment_id
ON public.reports(lemon_squeezy_payment_id);

CREATE INDEX IF NOT EXISTS idx_payments_lemon_squeezy_payment_id
ON public.payments(lemon_squeezy_payment_id);

-- Add helpful comments
COMMENT ON COLUMN public.reports.stripe_payment_id IS 'DEPRECATED: Legacy Stripe payment ID. Use lemon_squeezy_payment_id for new reports.';
COMMENT ON COLUMN public.reports.lemon_squeezy_payment_id IS 'LemonSqueezy order ID (primary payment processor)';

COMMENT ON COLUMN public.payments.stripe_payment_id IS 'DEPRECATED: Legacy Stripe payment ID. May contain LemonSqueezy IDs from old implementation.';
COMMENT ON COLUMN public.payments.lemon_squeezy_payment_id IS 'LemonSqueezy order ID (primary payment processor)';

-- Log the migration
DO $$
DECLARE
  reports_with_stripe INTEGER;
  reports_with_lemonsqueezy INTEGER;
BEGIN
  -- Count existing payment IDs
  SELECT COUNT(*) INTO reports_with_stripe
  FROM public.reports
  WHERE stripe_payment_id IS NOT NULL;

  SELECT COUNT(*) INTO reports_with_lemonsqueezy
  FROM public.reports
  WHERE lemon_squeezy_payment_id IS NOT NULL;

  RAISE NOTICE '✅ LemonSqueezy payment ID columns added successfully!';
  RAISE NOTICE '   - Reports with Stripe payment ID: %', reports_with_stripe;
  RAISE NOTICE '   - Reports with LemonSqueezy payment ID: %', reports_with_lemonsqueezy;
  RAISE NOTICE '   - Stripe columns marked as DEPRECATED';
END $$;
