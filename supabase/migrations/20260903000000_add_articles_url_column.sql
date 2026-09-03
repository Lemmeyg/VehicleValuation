-- Add a generated column holding the full public URL for each KB article.
--
-- `article_url` is derived automatically by Postgres from `slug`, so it is
-- always in sync: new articles get a URL on insert, and editing a slug
-- rewrites the URL. It cannot be written to directly.
--
-- The URL is built for every row regardless of `published`; unpublished
-- articles resolve to a 404 in the browser (check the `published` column).
--
-- Reversible with: ALTER TABLE articles DROP COLUMN article_url;

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS article_url text
  GENERATED ALWAYS AS ('https://totallosstoolkit.com/knowledge-base/' || slug) STORED;

COMMENT ON COLUMN articles.article_url IS
  'Full public URL of the article, auto-derived from slug (generated column, read-only). Unpublished articles 404.';
