-- =====================================================
-- Content Management System
-- Migration: 20241221000000
-- Description: Creates tables for Knowledge Base articles and enhances Suppliers table
-- =====================================================

-- ============================================================================
-- TABLE 1: articles (Knowledge Base Articles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(255) UNIQUE NOT NULL,

  -- Article Content
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL, -- Markdown content

  -- Categorization
  category VARCHAR(100) NOT NULL,
  tags TEXT[], -- Array of tags

  -- Author Information
  author VARCHAR(255) NOT NULL,

  -- Publishing
  featured BOOLEAN DEFAULT false,
  published BOOLEAN DEFAULT true,

  -- SEO & Reading
  reading_time VARCHAR(50), -- e.g., "5 min read"

  -- Storage Reference (optional - for markdown file in storage)
  storage_path TEXT, -- e.g., "knowledge-base/category/slug.md"

  -- Timestamps
  date_published TIMESTAMPTZ NOT NULL,
  date_modified TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for articles
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published) WHERE published = true;
CREATE INDEX IF NOT EXISTS idx_articles_featured ON articles(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_articles_date_published ON articles(date_published DESC);
CREATE INDEX IF NOT EXISTS idx_articles_tags ON articles USING GIN(tags);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_articles_search ON articles
  USING GIN(to_tsvector('english', title || ' ' || description || ' ' || content));

-- RLS Policies for articles
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Anyone can view published articles
CREATE POLICY "Anyone can view published articles"
  ON articles FOR SELECT
  TO public
  USING (published = true);

-- Authenticated users can view all articles (including drafts in dev)
CREATE POLICY "Authenticated users can view all articles"
  ON articles FOR SELECT
  TO authenticated
  USING (true);

-- Service role can manage all articles
CREATE POLICY "Service role can manage articles"
  ON articles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Apply updated_at trigger
CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 2: Enhanced suppliers table (populate from existing)
-- ============================================================================
-- Note: suppliers table already exists from 20241218000001_create_supplier_directory.sql
-- This migration adds additional columns and data population

-- Add content and storage path columns if they don't exist
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS zip_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS value_proposition TEXT,
  ADD COLUMN IF NOT EXISTS years_in_business INTEGER,
  ADD COLUMN IF NOT EXISTS specialties TEXT[], -- Array of specialty codes
  ADD COLUMN IF NOT EXISTS certifications TEXT[], -- Array of certifications
  ADD COLUMN IF NOT EXISTS insurance_accepted TEXT[]; -- Array of insurance carriers

-- Additional indexes for suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_city ON suppliers(city);
CREATE INDEX IF NOT EXISTS idx_suppliers_specialties ON suppliers USING GIN(specialties);
CREATE INDEX IF NOT EXISTS idx_suppliers_verified ON suppliers(verified) WHERE verified = true;

-- Full-text search for suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_search ON suppliers
  USING GIN(to_tsvector('english', business_name || ' ' || COALESCE(value_proposition, '') || ' ' || COALESCE(content, '')));

-- ============================================================================
-- STORAGE BUCKETS (Create these manually in Supabase Dashboard)
-- ============================================================================
-- These need to be created in the Supabase Dashboard under Storage:
--
-- Bucket 1: knowledge-base-content
-- - Public: true
-- - File size limit: 5MB
-- - Allowed MIME types: text/markdown, text/plain
--
-- Bucket 2: supplier-content
-- - Public: true
-- - File size limit: 5MB
-- - Allowed MIME types: text/markdown, text/plain
--
-- After creating buckets, run the RLS policies below:

-- ============================================================================
-- STORAGE RLS POLICIES (Run after creating buckets)
-- ============================================================================

-- Knowledge Base Storage Policies
CREATE POLICY "Anyone can read knowledge base files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'knowledge-base-content');

CREATE POLICY "Service role can upload knowledge base files"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'knowledge-base-content');

CREATE POLICY "Service role can update knowledge base files"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'knowledge-base-content');

CREATE POLICY "Service role can delete knowledge base files"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'knowledge-base-content');

-- Supplier Content Storage Policies
CREATE POLICY "Anyone can read supplier files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'supplier-content');

CREATE POLICY "Service role can upload supplier files"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'supplier-content');

CREATE POLICY "Service role can update supplier files"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'supplier-content');

CREATE POLICY "Service role can delete supplier files"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'supplier-content');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Search articles by keyword
CREATE OR REPLACE FUNCTION search_articles(search_query TEXT)
RETURNS TABLE (
  id UUID,
  slug VARCHAR,
  title VARCHAR,
  description TEXT,
  category VARCHAR,
  reading_time VARCHAR,
  date_published TIMESTAMPTZ,
  rank REAL
) AS $$
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
  FROM articles a
  WHERE
    published = true
    AND to_tsvector('english', a.title || ' ' || a.description || ' ' || a.content) @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC, date_published DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Search suppliers by keyword and filters
CREATE OR REPLACE FUNCTION search_suppliers(
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
) AS $$
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
  FROM suppliers s
  WHERE
    published = true
    AND (filter_state IS NULL OR s.state = filter_state)
    AND (filter_service_type IS NULL OR s.service_type = filter_service_type)
    AND (filter_specialties IS NULL OR s.specialties && filter_specialties)
    AND (
      search_query IS NULL
      OR to_tsvector('english', s.business_name || ' ' || COALESCE(s.value_proposition, '') || ' ' || COALESCE(s.content, '')) @@ plainto_tsquery('english', search_query)
    )
  ORDER BY s.featured DESC, rank DESC, s.business_name ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get article by slug
CREATE OR REPLACE FUNCTION get_article_by_slug(article_slug VARCHAR)
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
) AS $$
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
  FROM articles a
  WHERE a.slug = article_slug AND a.published = true;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get supplier by slug
CREATE OR REPLACE FUNCTION get_supplier_by_slug(supplier_slug VARCHAR)
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
) AS $$
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
  FROM suppliers s
  WHERE s.slug = supplier_slug AND s.published = true;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- VIEWS FOR ADMIN DASHBOARD
-- ============================================================================

-- View: Article statistics by category
CREATE OR REPLACE VIEW article_stats_by_category AS
SELECT
  category,
  COUNT(*) as total_articles,
  COUNT(*) FILTER (WHERE published = true) as published_articles,
  COUNT(*) FILTER (WHERE featured = true) as featured_articles,
  MAX(date_published) as latest_article_date
FROM articles
GROUP BY category
ORDER BY total_articles DESC;

-- View: Supplier statistics by type and state
CREATE OR REPLACE VIEW supplier_stats AS
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

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================
COMMENT ON TABLE articles IS 'Knowledge Base articles with markdown content and metadata';
COMMENT ON TABLE suppliers IS 'Directory of service providers (appraisers, body shops, advocates, attorneys)';

COMMENT ON COLUMN articles.storage_path IS 'Optional path to markdown file in Supabase Storage';
COMMENT ON COLUMN articles.content IS 'Full markdown content of the article';
COMMENT ON COLUMN suppliers.storage_path IS 'Optional path to markdown file in Supabase Storage';
COMMENT ON COLUMN suppliers.content IS 'Full markdown content for supplier profile';

-- ============================================================================
-- POST-MIGRATION INSTRUCTIONS
-- ============================================================================
--
-- After running this migration:
--
-- 1. Create storage buckets in Supabase Dashboard:
--    - Go to Storage > New Bucket
--    - Create: "knowledge-base-content" (public)
--    - Create: "supplier-content" (public)
--
-- 2. The storage RLS policies will be automatically applied
--
-- 3. Optionally migrate existing markdown files to database:
--    - Use the admin upload feature
--    - Or run a migration script to bulk import
--
-- 4. Update application code to read from database/storage
--    - lib/knowledge-base.ts will use articles table
--    - lib/suppliers.ts will use suppliers table
--
-- ============================================================================
