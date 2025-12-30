-- Supplier Directory Tables
-- Migration: 20241218000001
-- Description: Creates tables for supplier directory feature including lead tracking

-- ============================================================================
-- TABLE 1: supplier_leads (REQUIRED FOR MVP)
-- ============================================================================
-- Tracks lead submissions from users to suppliers
-- User can be anonymous (user_id NULL) or authenticated
CREATE TABLE supplier_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Supplier reference (slug from markdown file)
  supplier_slug VARCHAR(255) NOT NULL,

  -- User (optional - null if not logged in)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Lead contact info
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(20),

  -- Lead details
  message TEXT NOT NULL,
  service_needed VARCHAR(100),
  preferred_contact_method VARCHAR(20) CHECK (preferred_contact_method IN ('email', 'phone')),

  -- Metadata
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'closed')),
  source VARCHAR(50) DEFAULT 'directory_page',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_supplier_leads_supplier_slug ON supplier_leads(supplier_slug);
CREATE INDEX idx_supplier_leads_user_id ON supplier_leads(user_id);
CREATE INDEX idx_supplier_leads_created_at ON supplier_leads(created_at DESC);
CREATE INDEX idx_supplier_leads_status ON supplier_leads(status);

-- RLS Policies for supplier_leads
ALTER TABLE supplier_leads ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can create a lead (anonymous or authenticated)
CREATE POLICY "Anyone can create leads"
  ON supplier_leads
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Policy: Users can view their own leads
CREATE POLICY "Users can view own leads"
  ON supplier_leads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Service role can view all leads (for admin dashboard)
CREATE POLICY "Service role can view all leads"
  ON supplier_leads
  FOR SELECT
  TO service_role
  USING (true);

-- Updated_at trigger function (reusable)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger
CREATE TRIGGER update_supplier_leads_updated_at
  BEFORE UPDATE ON supplier_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 2: user_saved_suppliers (FUTURE - Phase 2)
-- ============================================================================
-- Allows authenticated users to save/bookmark suppliers for later
CREATE TABLE user_saved_suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_slug VARCHAR(255) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate saves
  UNIQUE(user_id, supplier_slug)
);

-- Index for user lookups
CREATE INDEX idx_user_saved_suppliers_user_id ON user_saved_suppliers(user_id);

-- RLS Policies
ALTER TABLE user_saved_suppliers ENABLE ROW LEVEL SECURITY;

-- Users can manage their own saved suppliers
CREATE POLICY "Users can manage own saved suppliers"
  ON user_saved_suppliers
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- TABLE 3: suppliers (OPTIONAL - Future database-driven approach)
-- ============================================================================
-- Currently suppliers are managed via markdown files
-- This table is for future features like ratings, performance tracking, etc.
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('appraiser', 'body_shop', 'advocate', 'attorney')),
  state VARCHAR(2) NOT NULL,
  verified BOOLEAN DEFAULT false,
  featured BOOLEAN DEFAULT false,
  published BOOLEAN DEFAULT true,

  -- Performance metrics (future)
  total_leads INTEGER DEFAULT 0,
  response_rate DECIMAL(5,2), -- percentage 0-100
  avg_response_time_hours INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_suppliers_slug ON suppliers(slug);
CREATE INDEX idx_suppliers_service_type ON suppliers(service_type);
CREATE INDEX idx_suppliers_state ON suppliers(state);
CREATE INDEX idx_suppliers_featured ON suppliers(featured) WHERE featured = true;

-- RLS Policies
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Anyone can view published suppliers
CREATE POLICY "Anyone can view published suppliers"
  ON suppliers
  FOR SELECT
  TO public
  USING (published = true);

-- Service role can manage all suppliers
CREATE POLICY "Service role can manage suppliers"
  ON suppliers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Apply updated_at trigger
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ANALYTICS VIEWS (Optional - for reporting)
-- ============================================================================

-- View: Lead statistics by supplier
CREATE OR REPLACE VIEW supplier_lead_stats AS
SELECT
  supplier_slug,
  COUNT(*) as total_leads,
  COUNT(CASE WHEN status = 'new' THEN 1 END) as new_leads,
  COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted_leads,
  COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_leads,
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as authenticated_leads,
  MAX(created_at) as last_lead_date,
  DATE_TRUNC('day', created_at) as lead_date
FROM supplier_leads
GROUP BY supplier_slug, DATE_TRUNC('day', created_at);

-- View: User lead history
CREATE OR REPLACE VIEW user_lead_history AS
SELECT
  user_id,
  supplier_slug,
  contact_name,
  contact_email,
  service_needed,
  status,
  created_at
FROM supplier_leads
WHERE user_id IS NOT NULL
ORDER BY created_at DESC;

-- ============================================================================
-- SEED DATA (Optional - for testing)
-- ============================================================================

-- Insert test lead (commented out for production)
-- INSERT INTO supplier_leads (
--   supplier_slug,
--   contact_name,
--   contact_email,
--   message,
--   service_needed,
--   preferred_contact_method
-- ) VALUES (
--   'john-smith-chicago-il',
--   'Test User',
--   'test@example.com',
--   'I need help with my total loss claim',
--   'vehicle_appraisal',
--   'email'
-- );
