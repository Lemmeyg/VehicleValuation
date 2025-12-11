-- Row Level Security (RLS) Policies
-- Phase 2: Database Security

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- REPORTS POLICIES
-- Users can only access their own reports
-- =============================================

-- Policy: Users can view their own reports
CREATE POLICY "Users can view own reports"
  ON reports
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create reports
CREATE POLICY "Users can create own reports"
  ON reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own reports
CREATE POLICY "Users can update own reports"
  ON reports
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users cannot delete reports (audit trail)
-- No DELETE policy = users cannot delete

-- =============================================
-- PAYMENTS POLICIES
-- Users can only view their own payments
-- =============================================

-- Policy: Users can view their own payments
CREATE POLICY "Users can view own payments"
  ON payments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert payments (via Stripe webhooks)
CREATE POLICY "Service role can insert payments"
  ON payments
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS, but explicit policy for clarity

-- Policy: No updates or deletes on payments (immutable audit log)

-- =============================================
-- REFUND_REQUESTS POLICIES
-- Users can manage their own refund requests
-- =============================================

-- Policy: Users can view their own refund requests
CREATE POLICY "Users can view own refund requests"
  ON refund_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create refund requests
CREATE POLICY "Users can create own refund requests"
  ON refund_requests
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending' -- Can only create pending requests
  );

-- Policy: Users can update their pending refund requests (upload docs)
CREATE POLICY "Users can update pending refund requests"
  ON refund_requests
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
  );

-- Admin updates (approve/deny) handled by service role

-- =============================================
-- API_CALL_LOGS POLICIES
-- Read-only for users (via their reports)
-- =============================================

-- Policy: Users can view API logs for their reports
CREATE POLICY "Users can view api logs for own reports"
  ON api_call_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM reports
      WHERE reports.id = api_call_logs.report_id
      AND reports.user_id = auth.uid()
    )
  );

-- Service role can insert API logs
CREATE POLICY "Service role can insert api logs"
  ON api_call_logs
  FOR INSERT
  WITH CHECK (true);

-- =============================================
-- USER_PROFILES POLICIES
-- Users can manage their own profile
-- =============================================

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Insert handled by trigger, no explicit policy needed

-- =============================================
-- HELPER FUNCTIONS FOR RLS
-- =============================================

-- Function: Check if user is admin (for future admin features)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'is_admin')::BOOLEAN,
      false
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON POLICY "Users can view own reports" ON reports IS
  'Users can only SELECT their own reports via user_id match';

COMMENT ON POLICY "Users can view own payments" ON payments IS
  'Users can only view payment records for their own transactions';

COMMENT ON POLICY "Users can create own refund requests" ON refund_requests IS
  'Users can create refund requests for their own reports with pending status';

COMMENT ON FUNCTION is_admin() IS
  'Helper function to check if current user has admin role';
