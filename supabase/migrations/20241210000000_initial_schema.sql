-- Initial Database Schema for Vehicle Valuation SaaS MVP
-- Phase 2: Database Setup

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- REPORTS TABLE
-- Stores vehicle valuation reports
-- =============================================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Vehicle Information
  vin VARCHAR(17) NOT NULL,
  vehicle_data JSONB NOT NULL, -- {year, make, model, trim, mileage, condition, color, previousAccidents}

  -- Accident Details
  accident_details JSONB, -- {accidentDate, location, description, acvReportUrl}

  -- Valuation Results
  valuation_result JSONB, -- {averageValue, lowValue, highValue, comparables[], generatedAt}

  -- Report Status
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'completed', 'failed')),

  -- Payment Information
  price_paid INTEGER NOT NULL, -- Amount in cents ($29 = 2900, $49 = 4900)
  stripe_payment_id VARCHAR(255),

  -- Generated PDF
  pdf_url TEXT,

  -- Data Retrieval Status
  data_retrieval_status VARCHAR(20) DEFAULT 'pending' CHECK (data_retrieval_status IN ('pending', 'in_progress', 'completed', 'failed')),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_vin ON reports(vin);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);

-- =============================================
-- PAYMENTS TABLE
-- Tracks Stripe payment transactions
-- =============================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Stripe Information
  stripe_payment_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_payment_intent_id VARCHAR(255),

  -- Payment Details
  amount INTEGER NOT NULL, -- Amount in cents
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),

  -- Metadata
  metadata JSONB, -- Additional payment information

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payments_report_id ON payments(report_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_stripe_payment_id ON payments(stripe_payment_id);
CREATE INDEX idx_payments_status ON payments(status);

-- =============================================
-- REFUND_REQUESTS TABLE
-- Tracks money-back guarantee refund requests
-- =============================================
CREATE TABLE refund_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Supporting Documentation
  acv_report_url TEXT NOT NULL, -- User's uploaded ACV report from carrier
  settlement_report_url TEXT NOT NULL, -- User's uploaded settlement documentation

  -- Claim Details
  carrier_offer_amount INTEGER NOT NULL, -- Original carrier offer in cents
  final_settlement_amount INTEGER NOT NULL, -- Final settlement in cents
  report_cost INTEGER NOT NULL, -- Cost of the report when refund was requested (cached from reports.price_paid)

  -- Request Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),

  -- Admin Review
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_refund_requests_report_id ON refund_requests(report_id);
CREATE INDEX idx_refund_requests_user_id ON refund_requests(user_id);
CREATE INDEX idx_refund_requests_status ON refund_requests(status);

-- =============================================
-- API_CALL_LOGS TABLE
-- Tracks external API calls and costs
-- =============================================
CREATE TABLE api_call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES reports(id) ON DELETE SET NULL,

  -- API Details
  api_provider VARCHAR(50) NOT NULL, -- 'vinaudit', 'autodev', 'carsxe'
  endpoint VARCHAR(255) NOT NULL,

  -- Cost Tracking
  cost DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Cost in dollars (e.g., 0.0200 for $0.02)

  -- Success/Failure
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,

  -- Performance
  response_time_ms INTEGER, -- Response time in milliseconds

  -- Metadata
  request_data JSONB, -- Request parameters (sanitized, no API keys)
  response_data JSONB, -- Response data (can be large)

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_api_call_logs_report_id ON api_call_logs(report_id);
CREATE INDEX idx_api_call_logs_api_provider ON api_call_logs(api_provider);
CREATE INDEX idx_api_call_logs_created_at ON api_call_logs(created_at DESC);
CREATE INDEX idx_api_call_logs_success ON api_call_logs(success);

-- =============================================
-- USER PROFILES TABLE (extends auth.users)
-- Additional user information
-- =============================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- User Information
  full_name TEXT,
  company TEXT, -- Optional, for business users

  -- Preferences
  email_notifications BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers: Auto-update updated_at
CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_refund_requests_updated_at
  BEFORE UPDATE ON refund_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function: Create user profile on signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Auto-create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();

-- Function: Check if refund request is valid
-- Returns true if final_settlement > carrier_offer + report_cost
CREATE OR REPLACE FUNCTION is_refund_valid(
  p_final_settlement INTEGER,
  p_carrier_offer INTEGER,
  p_report_cost INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_final_settlement > p_carrier_offer + p_report_cost;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================
-- COMMENTS (Documentation)
-- =============================================
COMMENT ON TABLE reports IS 'Vehicle valuation reports with pricing and status tracking';
COMMENT ON TABLE payments IS 'Stripe payment transactions linked to reports';
COMMENT ON TABLE refund_requests IS 'Money-back guarantee refund requests with validation';
COMMENT ON TABLE api_call_logs IS 'External API call tracking for cost analysis';
COMMENT ON TABLE user_profiles IS 'Extended user information beyond auth.users';

COMMENT ON COLUMN reports.price_paid IS 'Amount paid in cents (2900 = $29, 4900 = $49)';
COMMENT ON COLUMN refund_requests.report_cost IS 'Cached report cost at time of refund request (from reports.price_paid)';
COMMENT ON COLUMN api_call_logs.cost IS 'API call cost in dollars (e.g., 0.0200 for VinAudit)';
