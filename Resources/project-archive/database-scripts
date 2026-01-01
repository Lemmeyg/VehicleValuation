-- =====================================================
-- Vehicle Valuation SaaS - Complete Database Setup
-- =====================================================
-- This script sets up all required tables, indexes, RLS policies,
-- and functions for the Vehicle Valuation SaaS application.
--
-- Run this script in your Supabase SQL Editor after creating
-- a new project.
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- REPORTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vin VARCHAR(17) NOT NULL,
  vehicle_data JSONB,
  accident_details JSONB,
  valuation_result JSONB,
  price_paid INTEGER DEFAULT 0, -- Amount in cents
  stripe_payment_id TEXT,
  pdf_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports table indexes
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_vin ON reports(vin);
CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_user_created ON reports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_pdf_url ON reports(pdf_url) WHERE pdf_url IS NOT NULL;

-- Reports RLS policies
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================
-- PAYMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_id TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  amount INTEGER NOT NULL, -- Amount in cents
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table indexes
CREATE INDEX IF NOT EXISTS idx_payments_report_id ON payments(report_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_id ON payments(stripe_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- Payments RLS policies
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================
-- STORAGE BUCKET & POLICIES
-- =====================================================

-- Create storage bucket for PDFs (run this via Dashboard or API)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('vehicle-reports', 'vehicle-reports', true);

-- Storage RLS policies for vehicle-reports bucket
CREATE POLICY "Users can read own reports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'vehicle-reports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Service role can insert reports"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'vehicle-reports');

CREATE POLICY "Service role can update reports"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'vehicle-reports');

CREATE POLICY "Service role can delete reports"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'vehicle-reports');

-- =====================================================
-- ADMIN AUDIT LOG (Optional but Recommended)
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_id UUID,
  target_type TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user_id ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action);

-- Admin audit log RLS
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON admin_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'is_admin' = 'true'
    )
  );

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS FOR ADMIN DASHBOARD
-- =====================================================

-- Admin dashboard stats view
CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT
  COUNT(*) as total_reports,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_reports,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_reports,
  COUNT(*) FILTER (WHERE status = 'draft') as draft_reports,
  COUNT(*) FILTER (WHERE price_paid > 0) as paid_reports,
  COALESCE(SUM(price_paid), 0) as total_revenue
FROM reports;

-- User analytics view
CREATE OR REPLACE VIEW user_analytics AS
SELECT
  user_id,
  COUNT(*) as total_reports,
  COUNT(*) FILTER (WHERE price_paid > 0) as paid_reports,
  COALESCE(SUM(price_paid), 0) as total_spent,
  MIN(created_at) as first_report,
  MAX(created_at) as last_activity
FROM reports
GROUP BY user_id;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get user count (for admin dashboard)
CREATE OR REPLACE FUNCTION get_user_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(DISTINCT user_id) FROM reports);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SAMPLE ADMIN USER SETUP
-- =====================================================

-- After running this script, create an admin user:
-- 1. Sign up a user via the application
-- 2. Run this SQL to make them admin:
--
-- UPDATE auth.users
-- SET raw_user_meta_data = raw_user_meta_data || '{"is_admin": true}'::jsonb
-- WHERE email = 'your-admin-email@example.com';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Run these to verify setup:

-- Check tables exist
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('reports', 'payments', 'admin_audit_log');

-- Check indexes
-- SELECT indexname FROM pg_indexes
-- WHERE schemaname = 'public'
-- AND tablename IN ('reports', 'payments');

-- Check RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('reports', 'payments');

-- Check views
-- SELECT viewname FROM pg_views
-- WHERE schemaname = 'public';

-- =====================================================
-- CLEANUP (if needed)
-- =====================================================

-- To drop all tables and start fresh (USE WITH CAUTION):
-- DROP TABLE IF EXISTS admin_audit_log CASCADE;
-- DROP TABLE IF EXISTS payments CASCADE;
-- DROP TABLE IF EXISTS reports CASCADE;
-- DROP VIEW IF EXISTS admin_dashboard_stats CASCADE;
-- DROP VIEW IF EXISTS user_analytics CASCADE;
-- DROP FUNCTION IF EXISTS get_user_count();
-- DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- =====================================================
-- END OF SETUP SCRIPT
-- =====================================================

-- Next steps:
-- 1. Create storage bucket 'vehicle-reports' in Supabase Dashboard
-- 2. Add Stripe API keys to .env.local
-- 3. Create admin user (see SAMPLE ADMIN USER SETUP above)
-- 4. Test the application!
