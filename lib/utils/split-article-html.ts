/**
 * Split Article HTML
 *
 * Splits a rendered article HTML string at two anchor points so that
 * ArticleReportBar components can be interleaved between HTML segments.
 *
 * All headings in the HTML use the rehype-autolink-headings wrap pattern:
 *   <h2 id="..."><a href="#...">Heading Text</a></h2>
 */

export type HtmlSegment = { type: 'html'; content: string }
export type BarSegment = { type: 'bar'; placement: 'post_toc' | 'post_faq_2' | 'fallback_mid' }
export type ArticleSegment = HtmlSegment | BarSegment

/**
 * Find the index immediately after the outermost </ul> that closes the TOC.
 * Handles nested lists by counting open/close tags.
 * Returns -1 if not found.
 */
function findTocEnd(html: string, tocHeadingEnd: number): number {
  const ulOpen = /<ul/g
  const ulClose = /(<\/ul>)/g

  // Find first <ul after the TOC heading
  ulOpen.lastIndex = tocHeadingEnd
  const firstUl = ulOpen.exec(html)
  if (!firstUl) return -1

  let depth = 1
  ulClose.lastIndex = firstUl.index + firstUl[0].length

  while (depth > 0) {
    // Find next open or close, whichever comes first
    const nextOpen = html.indexOf('<ul', ulClose.lastIndex)
    const closeMatch = ulClose.exec(html)
    if (!closeMatch) return -1

    if (nextOpen !== -1 && nextOpen < closeMatch.index) {
      // An open tag came before this close — increment depth
      depth++
      ulClose.lastIndex = nextOpen + 3 // skip past '<ul'
    } else {
      depth--
      if (depth === 0) {
        return closeMatch.index + closeMatch[0].length
      }
    }
  }

  return -1
}

/**
 * Find the [start, end) ranges of every <pre>...</pre> and <code>...</code>
 * region in the html, so candidate split points can avoid landing inside one.
 *
 * A "</p>" can appear as literal text inside a code sample (e.g. a fenced
 * markdown block showing HTML source) rather than as a real paragraph close.
 * Splitting there would inject a React component into the middle of a <pre>
 * or <code> element and visibly break the rendered markup.
 *
 * Also covers unclosed tags: an opening <pre> or <code> with no matching
 * close protects everything from its position to the end of the string — an
 * unterminated block means everything after it renders as part of that
 * element as far as the browser is concerned, so a "</p>" further along is
 * just as unsafe to split on as one inside a properly closed region.
 */
function findProtectedRegions(html: string): Array<[number, number]> {
  const regions: Array<[number, number]> = []
  const tagPattern = /<(pre|code)\b[^>]*>[\s\S]*?<\/\1>/gi
  let match: RegExpExecArray | null
  while ((match = tagPattern.exec(html)) !== null) {
    regions.push([match.index, match.index + match[0].length])
  }

  const openTagPattern = /<(pre|code)\b[^>]*>/gi
  let openMatch: RegExpExecArray | null
  while ((openMatch = openTagPattern.exec(html)) !== null) {
    const start = openMatch.index
    const alreadyClosed = regions.some(
      ([regionStart, regionEnd]) => start >= regionStart && start < regionEnd
    )
    if (!alreadyClosed) {
      regions.push([start, html.length])
    }
  }

  return regions
}

function isInsideProtectedRegion(position: number, regions: Array<[number, number]>): boolean {
  return regions.some(([start, end]) => position > start && position < end)
}

/**
 * Find a safe split point near the middle of the article.
 *
 * "Safe" means immediately after a closing </p> that (a) leaves content on
 * both sides, and (b) does not fall inside a <pre> or <code> region — whether
 * that region is properly closed or left open to the end of the string (see
 * findProtectedRegions). A literal "</p>" can appear as text inside a code
 * sample rather than as a real paragraph close, and splitting there would
 * inject a React component into the middle of a <pre>/<code> element.
 *
 * This guard is enforced by the code, not merely assumed: it holds regardless
 * of what produced the html. As a separate, weaker note — the markdown
 * pipeline that currently feeds this function (lib/markdown.ts) has been
 * verified to escape "<" to the numeric entity "&#x3C;" before it reaches
 * <pre>/<code> output, and to drop raw HTML blocks entirely (no rehype-raw),
 * so a literal "</p>" cannot currently reach a code region through that
 * pipeline at all. That makes the guard belt-and-braces against today's
 * inputs, but it is not why the guard exists — the guard exists because the
 * function must not assume anything about its caller.
 *
 * Returns -1 if there is no usable boundary — including the case where every
 * candidate is inside a protected region.
 */
function findMidParagraphBoundary(html: string): number {
  const target = Math.floor(html.length * 0.45)
  const boundaries: number[] = []

  let idx = html.indexOf('</p>')
  while (idx !== -1) {
    boundaries.push(idx + '</p>'.length)
    idx = html.indexOf('</p>', idx + 1)
  }

  const protectedRegions = findProtectedRegions(html)

  // Need content on both sides — a boundary at the very end is not a split —
  // and must not fall inside a <pre>/<code> region.
  const usable = boundaries.filter(
    b => b > 0 && b < html.length && !isInsideProtectedRegion(b, protectedRegions)
  )
  if (usable.length === 0) return -1

  return usable.reduce((best, b) => (Math.abs(b - target) < Math.abs(best - target) ? b : best))
}

/**
 * Split the article HTML string into ordered segments with injection points.
 *
 * Segments are returned in document order:
 *   [ html, bar(post_toc), html, bar(post_faq_2), html ]
 *
 * Either bar may be absent if its anchor cannot be detected.
 */
export function splitArticleHtml(html: string): ArticleSegment[] {
  const segments: ArticleSegment[] = []
  let cursor = 0

  // ── Placement 1: post_toc ────────────────────────────────────────────────
  const tocHeadingMatch = html.match(/<h2[^>]*><a[^>]*>[^<]*table of contents[^<]*<\/a><\/h2>/i)

  if (tocHeadingMatch && tocHeadingMatch.index !== undefined) {
    const tocHeadingEnd = tocHeadingMatch.index + tocHeadingMatch[0].length
    const tocEnd = findTocEnd(html, tocHeadingEnd)

    if (tocEnd !== -1) {
      segments.push({ type: 'html', content: html.slice(cursor, tocEnd) })
      segments.push({ type: 'bar', placement: 'post_toc' })
      cursor = tocEnd
    }
  }

  // ── Placement 2: post_faq_2 ──────────────────────────────────────────────
  const searchFrom = cursor
  const faqHeadingMatch = html
    .slice(searchFrom)
    .match(/<h2[^>]*><a[^>]*>[^<]*(frequently asked questions|faq)[^<]*<\/a><\/h2>/i)

  if (faqHeadingMatch && faqHeadingMatch.index !== undefined) {
    const faqHeadingAbsStart = searchFrom + faqHeadingMatch.index
    const faqHeadingAbsEnd = faqHeadingAbsStart + faqHeadingMatch[0].length

    // Find first <h3 after the FAQ heading
    const q1Start = html.indexOf('<h3', faqHeadingAbsEnd)
    if (q1Start !== -1) {
      // Find end of q1's opening tag
      const q1TagEnd = html.indexOf('</h3>', q1Start) + '</h3>'.length

      // Find second <h3 after q1's tag end
      const q2Start = html.indexOf('<h3', q1TagEnd)
      if (q2Start !== -1) {
        const q2TagEnd = html.indexOf('</h3>', q2Start) + '</h3>'.length

        // Find next heading (<h2 or <h3) after the end of q2's tag
        const nextH2 = html.indexOf('<h2', q2TagEnd)
        const nextH3 = html.indexOf('<h3', q2TagEnd)

        let splitPoint = -1
        if (nextH2 !== -1 && nextH3 !== -1) {
          splitPoint = Math.min(nextH2, nextH3)
        } else if (nextH2 !== -1) {
          splitPoint = nextH2
        } else if (nextH3 !== -1) {
          splitPoint = nextH3
        }

        if (splitPoint !== -1) {
          segments.push({ type: 'html', content: html.slice(cursor, splitPoint) })
          segments.push({ type: 'bar', placement: 'post_faq_2' })
          cursor = splitPoint
        }
      }
    }
  }

  // ── Fallback ─────────────────────────────────────────────────────────────
  // If neither anchor matched, the article would render no report form at all.
  // Place one near the middle, at a paragraph boundary.
  if (!segments.some(s => s.type === 'bar')) {
    const mid = findMidParagraphBoundary(html)
    if (mid !== -1) {
      segments.push({ type: 'html', content: html.slice(cursor, mid) })
      segments.push({ type: 'bar', placement: 'fallback_mid' })
      cursor = mid
    }
  }

  // ── Remainder ────────────────────────────────────────────────────────────
  if (cursor < html.length) {
    segments.push({ type: 'html', content: html.slice(cursor) })
  }

  return segments
}
