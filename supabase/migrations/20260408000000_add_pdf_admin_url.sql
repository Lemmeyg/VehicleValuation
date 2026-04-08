-- Adds a long-lived admin URL for each generated PDF.
-- Only visible to database admins — never returned by any API route.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS pdf_admin_url TEXT;
