-- Migration: Fix broken internal links in articles
-- These links pointed to non-existent pages and caused 404 errors when crawled

-- Update the how-to-remove-high-risk-driver-from-insurance article
-- to remove broken INTERNAL: links that don't have corresponding pages

UPDATE articles
SET content = REPLACE(
  content,
  '[denied claims and policy cancellation](INTERNAL:/insurance-claim-denial-reasons)',
  'denied claims and policy cancellation'
)
WHERE slug = 'how-to-remove-high-risk-driver-from-insurance';

-- Remove the "Related Resources" section with broken links
UPDATE articles
SET content = REPLACE(
  content,
  E'For more guidance on managing high-risk drivers and protecting your family''s insurance coverage, explore these related resources:\n- [Understanding Auto Insurance Exclusions and Endorsements](INTERNAL:/auto-insurance-exclusions-guide)\n- [Teen Driver Insurance: Complete Parent''s Guide](INTERNAL:/teen-driver-insurance-guide)\n- [What to Do After Multiple Car Accidents](INTERNAL:/multiple-accidents-insurance-impact)\n\nRemember, you''re not alone in facing this challenge.',
  'Remember, you''re not alone in facing this challenge.'
)
WHERE slug = 'how-to-remove-high-risk-driver-from-insurance';

-- Also try with Windows-style line endings (CRLF)
UPDATE articles
SET content = REPLACE(
  content,
  E'For more guidance on managing high-risk drivers and protecting your family''s insurance coverage, explore these related resources:\r\n- [Understanding Auto Insurance Exclusions and Endorsements](INTERNAL:/auto-insurance-exclusions-guide)\r\n- [Teen Driver Insurance: Complete Parent''s Guide](INTERNAL:/teen-driver-insurance-guide)\r\n- [What to Do After Multiple Car Accidents](INTERNAL:/multiple-accidents-insurance-impact)\r\n\r\nRemember, you''re not alone in facing this challenge.',
  'Remember, you''re not alone in facing this challenge.'
)
WHERE slug = 'how-to-remove-high-risk-driver-from-insurance';

-- General cleanup: Remove any remaining references to these non-existent pages
-- across all articles (in case they appear elsewhere)
UPDATE articles
SET content = REPLACE(content, '(INTERNAL:/insurance-claim-denial-reasons)', '')
WHERE content LIKE '%INTERNAL:/insurance-claim-denial-reasons%';

UPDATE articles
SET content = REPLACE(content, '(INTERNAL:/teen-driver-insurance-guide)', '')
WHERE content LIKE '%INTERNAL:/teen-driver-insurance-guide%';

UPDATE articles
SET content = REPLACE(content, '(INTERNAL:/auto-insurance-exclusions-guide)', '')
WHERE content LIKE '%INTERNAL:/auto-insurance-exclusions-guide%';

UPDATE articles
SET content = REPLACE(content, '(INTERNAL:/multiple-accidents-insurance-impact)', '')
WHERE content LIKE '%INTERNAL:/multiple-accidents-insurance-impact%';
