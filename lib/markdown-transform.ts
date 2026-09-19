/**
 * Hero-form link transformation for KB article HTML.
 *
 * Transforms /#hero-form anchor links in rendered HTML:
 * - Standalone <p><a href="...#hero-form">text</a></p>: first 2 occurrences → callout box
 * - Standalone /#hero-form paragraphs beyond the 2nd → inline CTA link
 * - Inline /#hero-form links embedded in prose → hero-form-cta-inline class
 *
 * This module has no dependencies so it can be imported by Jest without
 * requiring ESM transformation of the unified/remark/rehype ecosystem.
 */

/**
 * Root-relative on purpose, never an absolute URL with a hostname.
 *
 * The site answers on both `totallosstoolkit.com` and `www.totallosstoolkit.com`
 * (neither redirects to the other). Those are two different browser origins, so
 * they do not share `sessionStorage` or `localStorage`. Sending a reader who is
 * on one host to a link hardcoded to the other silently discards the whole
 * purchase handoff: `pending_report` / `current_report_id` (read by
 * `app/pricing/page.tsx`), the `tlt_checkout_handoff` marker
 * (`lib/analytics/checkout-return.ts`), and KB attribution
 * (`lib/analytics/kb-attribution.ts`).
 *
 * `/#hero-form` keeps the reader on whichever host they already arrived on.
 */
const HERO_FORM_URL = '/#hero-form'

function heroFormCalloutBox(anchorText: string): string {
  return `<div class="hero-form-callout">
  <p class="hero-form-callout__title">Check Your Vehicle&#39;s Value</p>
  <p class="hero-form-callout__body">See what your car is actually worth before accepting any settlement offer.</p>
  <a href="${HERO_FORM_URL}" class="hero-form-callout__btn">${anchorText}</a>
</div>`
}

/**
 * Transform /#hero-form links in rendered HTML:
 * - Standalone <p><a href="...#hero-form">text</a></p>: first 2 → callout box, 3rd+ → inline CTA
 * - Inline <a href="...#hero-form"> embedded in prose: → hero-form-cta-inline class
 */
export function transformHeroFormLinks(html: string): string {
  let calloutCount = 0

  // Pass 1: standalone paragraphs — entire <p> is a single hero-form anchor
  let result = html.replace(
    /<p>\s*<a href="([^"]*#hero-form)">([^<]*)<\/a>\s*<\/p>/gi,
    (_match, _href, anchorText) => {
      calloutCount++
      if (calloutCount <= 2) {
        return heroFormCalloutBox(anchorText.trim())
      }
      return `<p><a href="${HERO_FORM_URL}" class="hero-form-cta-inline">${anchorText.trim()}</a></p>`
    }
  )

  // Pass 2: remaining inline hero-form anchors (embedded in prose paragraphs)
  result = result.replace(
    /<a href="([^"]*#hero-form)"([^>]*)>([^<]*)<\/a>/gi,
    (_match, _href, existingAttrs, anchorText) => {
      // existingAttrs is the raw attribute string from rehype-stringify (e.g. ' class="hero-form-callout__btn"')
      // — predictably formatted, so substring matching is reliable for skip detection
      // Skip already-processed links (callout btn or inline CTA)
      if (
        existingAttrs.includes('hero-form-callout__btn') ||
        existingAttrs.includes('hero-form-cta-inline')
      ) {
        return _match
      }
      return `<a href="${HERO_FORM_URL}" class="hero-form-cta-inline">${anchorText}</a>`
    }
  )

  return result
}
