-- ============================================================================
-- Fix Function Search Path Security Vulnerabilities
-- ============================================================================
-- This migration fixes the Supabase linter warnings about functions with
-- mutable search_path.
--
-- The issue: When search_path is not explicitly set, a malicious user could
-- potentially exploit this by creating objects in schemas that appear earlier
-- in the search_path, leading to privilege escalation attacks.
--
-- The fix: Add SET search_path = '' to all functions, which forces explicit
-- schema qualification and prevents search_path attacks.
--
-- Functions affected:
-- 1. update_contact_messages_updated_at
-- 2. is_admin
-- 3. search_articles
-- 4. search_suppliers
-- 5. get_article_by_slug
-- 6. get_supplier_by_slug
-- 7. get_supplier_lead_stats
-- 8. handle_new_user
-- 9. update_updated_at_column
-- 10. is_refund_valid
-- 11. create_user_profile
--
-- Migration: 20260116000000_fix_function_search_path.sql
-- ============================================================================


-- ============================================================================
-- 1. Fix update_contact_messages_updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_contact_messages_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ============================================================================
-- 2. Fix is_admin (preserves SECURITY DEFINER)
-- ============================================================================
-- Use CREATE OR REPLACE to avoid dropping (policies depend on this function)
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = COALESCE(check_user_id, auth.uid())
  );
END;
$$;

COMMENT ON FUNCTION public.is_admin IS 'Securely checks if a user is an admin by querying the admins table. Uses SECURITY DEFINER with restricted search_path.';


-- ============================================================================
-- 3. Fix search_articles
-- ============================================================================
CREATE OR REPLACE FUNCTION public.search_articles(search_query TEXT)
RETURNS TABLE (
  id UUID,
  slug VARCHAR,
  title VARCHAR,
  description TEXT,
  category VARCHAR,
  reading_time VARCHAR,
  date_published TIMESTAMPTZ,
  rank REAL
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.slug,
    a.title,
    a.description,
    a.category,
    a.reading_time,
    a.date_published,
    ts_rank(
      to_tsvector('english', a.title || ' ' || a.description || ' ' || a.content),
      plainto_tsquery('english', search_query)
    ) as rank
  FROM public.articles a
  WHERE
    a.published = true
    AND to_tsvector('english', a.title || ' ' || a.description || ' ' || a.content) @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC, a.date_published DESC;
END;
$$;


-- ============================================================================
-- 4. Fix search_suppliers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.search_suppliers(
  search_query TEXT DEFAULT NULL,
  filter_state VARCHAR DEFAULT NULL,
  filter_service_type VARCHAR DEFAULT NULL,
  filter_specialties TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  slug VARCHAR,
  business_name VARCHAR,
  service_type VARCHAR,
  city VARCHAR,
  state VARCHAR,
  verified BOOLEAN,
  featured BOOLEAN,
  value_proposition TEXT,
  rank REAL
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.slug,
    s.business_name,
    s.service_type,
    s.city,
    s.state,
    s.verified,
    s.featured,
    s.value_proposition,
    CASE
      WHEN search_query IS NOT NULL THEN
        ts_rank(
          to_tsvector('english', s.business_name || ' ' || COALESCE(s.value_proposition, '') || ' ' || COALESCE(s.content, '')),
          plainto_tsquery('english', search_query)
        )
      ELSE 1.0
    END as rank
  FROM public.suppliers s
  WHERE
    s.published = true
    AND (filter_state IS NULL OR s.state = filter_state)
    AND (filter_service_type IS NULL OR s.service_type = filter_service_type)
    AND (filter_specialties IS NULL OR s.specialties && filter_specialties)
    AND (
      search_query IS NULL
      OR to_tsvector('english', s.business_name || ' ' || COALESCE(s.value_proposition, '') || ' ' || COALESCE(s.content, '')) @@ plainto_tsquery('english', search_query)
    )
  ORDER BY s.featured DESC, rank DESC, s.business_name ASC;
END;
$$;


-- ============================================================================
-- 5. Fix get_article_by_slug
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_article_by_slug(article_slug VARCHAR)
RETURNS TABLE (
  id UUID,
  slug VARCHAR,
  title VARCHAR,
  description TEXT,
  content TEXT,
  category VARCHAR,
  tags TEXT[],
  author VARCHAR,
  featured BOOLEAN,
  reading_time VARCHAR,
  date_published TIMESTAMPTZ,
  date_modified TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.slug,
    a.title,
    a.description,
    a.content,
    a.category,
    a.tags,
    a.author,
    a.featured,
    a.reading_time,
    a.date_published,
    a.date_modified
  FROM public.articles a
  WHERE a.slug = article_slug AND a.published = true;
END;
$$;


-- ============================================================================
-- 6. Fix get_supplier_by_slug
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_supplier_by_slug(supplier_slug VARCHAR)
RETURNS TABLE (
  id UUID,
  slug VARCHAR,
  business_name VARCHAR,
  contact_name VARCHAR,
  contact_email VARCHAR,
  contact_phone VARCHAR,
  website_url TEXT,
  service_type VARCHAR,
  city VARCHAR,
  state VARCHAR,
  zip_code VARCHAR,
  value_proposition TEXT,
  years_in_business INTEGER,
  specialties TEXT[],
  certifications TEXT[],
  insurance_accepted TEXT[],
  verified BOOLEAN,
  featured BOOLEAN,
  content TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.slug,
    s.business_name,
    s.contact_name,
    s.contact_email,
    s.contact_phone,
    s.website_url,
    s.service_type,
    s.city,
    s.state,
    s.zip_code,
    s.value_proposition,
    s.years_in_business,
    s.specialties,
    s.certifications,
    s.insurance_accepted,
    s.verified,
    s.featured,
    s.content
  FROM public.suppliers s
  WHERE s.slug = supplier_slug AND s.published = true;
END;
$$;


-- ============================================================================
-- 7. Fix get_supplier_lead_stats (preserves SECURITY DEFINER)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_supplier_lead_stats()
RETURNS TABLE (
  supplier_slug VARCHAR,
  total_leads BIGINT,
  new_leads BIGINT,
  contacted_leads BIGINT,
  converted_leads BIGINT,
  authenticated_leads BIGINT,
  last_lead_date TIMESTAMPTZ,
  lead_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only allow admins to call this function
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    sl.supplier_slug,
    COUNT(*)::BIGINT as total_leads,
    COUNT(CASE WHEN sl.status = 'new' THEN 1 END)::BIGINT as new_leads,
    COUNT(CASE WHEN sl.status = 'contacted' THEN 1 END)::BIGINT as contacted_leads,
    COUNT(CASE WHEN sl.status = 'converted' THEN 1 END)::BIGINT as converted_leads,
    COUNT(CASE WHEN sl.user_id IS NOT NULL THEN 1 END)::BIGINT as authenticated_leads,
    MAX(sl.created_at) as last_lead_date,
    DATE_TRUNC('day', sl.created_at) as lead_date
  FROM public.supplier_leads sl
  GROUP BY sl.supplier_slug, DATE_TRUNC('day', sl.created_at);
END;
$$;

COMMENT ON FUNCTION public.get_supplier_lead_stats IS 'Returns aggregated lead statistics by supplier. Requires admin privileges. Uses SECURITY DEFINER with restricted search_path.';


-- ============================================================================
-- 8. Fix handle_new_user (preserves SECURITY DEFINER)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;


-- ============================================================================
-- 9. Fix update_updated_at_column
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ============================================================================
-- 10. Fix is_refund_valid
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_refund_valid(
  p_final_settlement INTEGER,
  p_carrier_offer INTEGER,
  p_report_cost INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  RETURN p_final_settlement > p_carrier_offer + p_report_cost;
END;
$$;


-- ============================================================================
-- 11. Fix create_user_profile (preserves SECURITY DEFINER)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;


-- ============================================================================
-- Migration complete
-- ============================================================================
-- After this migration:
-- - All 11 functions now have SET search_path = ''
-- - Functions using SECURITY DEFINER are preserved but now more secure
-- - Explicit schema qualification (public.) prevents search_path attacks
--
-- The Supabase linter warnings for function_search_path_mutable should be resolved.
