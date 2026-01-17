-- ============================================================================
-- Fix SECURITY DEFINER View Errors
-- ============================================================================
-- This migration fixes the Supabase linter errors about SECURITY DEFINER views.
--
-- The issue: Views by default use SECURITY DEFINER in PostgreSQL, which means
-- they run with the permissions of the view creator (usually postgres/superuser)
-- rather than the querying user. This bypasses RLS policies.
--
-- The fix: Recreate views with SECURITY INVOKER so they respect the
-- permissions and RLS policies of the user making the query.
--
-- Views affected:
-- 1. user_lead_history - User's own lead submissions
-- 2. supplier_stats - Aggregated supplier statistics (public data)
-- 3. article_stats_by_category - Aggregated article statistics (public data)
-- 4. supplier_lead_stats - Lead statistics by supplier (admin only)
--
-- Migration: 20260115000000_fix_security_definer_views.sql
-- ============================================================================

-- ============================================================================
-- 1. Fix user_lead_history view
-- ============================================================================
-- This view shows users their own lead submissions.
-- Using SECURITY INVOKER means RLS on supplier_leads will be respected.

DROP VIEW IF EXISTS user_lead_history;

CREATE VIEW user_lead_history
WITH (security_invoker = true) AS
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

COMMENT ON VIEW user_lead_history IS
'Shows lead submission history. Uses SECURITY INVOKER so RLS policies on supplier_leads are enforced - users can only see their own leads.';

-- Grant access to authenticated users
GRANT SELECT ON user_lead_history TO authenticated;


-- ============================================================================
-- 2. Fix supplier_stats view
-- ============================================================================
-- This view aggregates published supplier data - safe for public access.
-- Using SECURITY INVOKER with public data is fine.

DROP VIEW IF EXISTS supplier_stats;

CREATE VIEW supplier_stats
WITH (security_invoker = true) AS
SELECT
  service_type,
  state,
  COUNT(*) as total_suppliers,
  COUNT(*) FILTER (WHERE verified = true) as verified_suppliers,
  COUNT(*) FILTER (WHERE featured = true) as featured_suppliers,
  AVG(years_in_business) as avg_years_in_business
FROM suppliers
WHERE published = true
GROUP BY service_type, state
ORDER BY service_type, state;

COMMENT ON VIEW supplier_stats IS
'Aggregates supplier statistics by service type and state. Uses SECURITY INVOKER. Only includes published suppliers so safe for public access.';

-- Grant access (public data)
GRANT SELECT ON supplier_stats TO anon, authenticated;


-- ============================================================================
-- 3. Fix article_stats_by_category view
-- ============================================================================
-- This view aggregates article statistics - safe for public access.

DROP VIEW IF EXISTS article_stats_by_category;

CREATE VIEW article_stats_by_category
WITH (security_invoker = true) AS
SELECT
  category,
  COUNT(*) as total_articles,
  COUNT(*) FILTER (WHERE published = true) as published_articles,
  COUNT(*) FILTER (WHERE featured = true) as featured_articles,
  MAX(date_published) as latest_article_date
FROM articles
GROUP BY category
ORDER BY total_articles DESC;

COMMENT ON VIEW article_stats_by_category IS
'Aggregates article statistics by category. Uses SECURITY INVOKER. Shows counts only, safe for public access.';

-- Grant access (public data)
GRANT SELECT ON article_stats_by_category TO anon, authenticated;


-- ============================================================================
-- 4. Fix supplier_lead_stats view
-- ============================================================================
-- This view shows lead statistics per supplier - should be admin only.
-- We'll create it with SECURITY INVOKER but the underlying table's RLS
-- policies will restrict access appropriately.

DROP VIEW IF EXISTS supplier_lead_stats;

CREATE VIEW supplier_lead_stats
WITH (security_invoker = true) AS
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

COMMENT ON VIEW supplier_lead_stats IS
'Aggregates lead statistics by supplier and date. Uses SECURITY INVOKER so RLS on supplier_leads is respected. Access controlled by underlying table policies.';

-- Only authenticated users (admins through RLS)
GRANT SELECT ON supplier_lead_stats TO authenticated;


-- ============================================================================
-- Ensure RLS is enabled on underlying tables
-- ============================================================================
-- The views now use SECURITY INVOKER, so they will respect these RLS policies.

-- Verify RLS is enabled (these are idempotent)
ALTER TABLE supplier_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- Add RLS policy for supplier_leads if not exists
-- ============================================================================
-- Users should only see their own leads, admins can see all

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view their own leads" ON supplier_leads;
DROP POLICY IF EXISTS "Admins can view all leads" ON supplier_leads;

-- Users can view their own leads
CREATE POLICY "Users can view their own leads"
ON supplier_leads
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can view all leads
CREATE POLICY "Admins can view all leads"
ON supplier_leads
FOR SELECT
TO authenticated
USING (public.is_admin());


-- ============================================================================
-- Migration complete
-- ============================================================================
-- After this migration:
-- - All 4 views use SECURITY INVOKER instead of SECURITY DEFINER
-- - Views respect RLS policies on underlying tables
-- - user_lead_history: Users see only their own leads
-- - supplier_stats: Public aggregate data (published suppliers only)
-- - article_stats_by_category: Public aggregate data
-- - supplier_lead_stats: Respects RLS on supplier_leads (admin access via policy)
--
-- The Supabase linter warnings should be resolved after applying this migration.
