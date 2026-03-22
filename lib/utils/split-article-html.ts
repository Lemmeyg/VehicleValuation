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
export type BarSegment = { type: 'bar'; placement: 'post_toc' | 'post_faq_2' }
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

  // ── Remainder ────────────────────────────────────────────────────────────
  if (cursor < html.length) {
    segments.push({ type: 'html', content: html.slice(cursor) })
  }

  return segments
}
