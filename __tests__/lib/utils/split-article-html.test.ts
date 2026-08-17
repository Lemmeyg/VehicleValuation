/**
 * Tests for splitArticleHtml utility
 *
 * Verifies the HTML string is split correctly at the TOC end
 * and after the second FAQ answer, returning typed segments.
 */
import { splitArticleHtml, HtmlSegment, ArticleSegment } from '@/lib/utils/split-article-html'

// Minimal HTML that mirrors the rehype-autolink-headings output
const makeHtml = ({
  tocItems = 2,
  faqCount = 3,
  nested = false,
}: {
  tocItems?: number
  faqCount?: number
  nested?: boolean
} = {}) => {
  const tocList = nested
    ? `<ul><li>Item<ul><li>Sub</li></ul></li></ul>`
    : `<ul>${Array(tocItems).fill('<li><a href="#">Item</a></li>').join('')}</ul>`

  const faqItems = Array(faqCount)
    .fill(null)
    .map(
      (_, i) => `<h3 id="q${i}"><a href="#q${i}">Question ${i + 1}?</a></h3><p>Answer ${i + 1}</p>`
    )
    .join('')

  return [
    `<p>Intro paragraph</p>`,
    `<h2 id="table-of-contents"><a href="#table-of-contents">Table of Contents</a></h2>`,
    tocList,
    `<h2 id="section-1"><a href="#section-1">Section 1</a></h2><p>Body text.</p>`,
    `<h2 id="frequently-asked-questions"><a href="#frequently-asked-questions">Frequently Asked Questions</a></h2>`,
    faqItems,
    `<h2 id="conclusion"><a href="#conclusion">Conclusion</a></h2><p>Done.</p>`,
  ].join('')
}

describe('splitArticleHtml', () => {
  describe('post_toc placement', () => {
    it('produces a post_toc bar segment after the TOC closing ul', () => {
      const segments = splitArticleHtml(makeHtml())
      const barSegments = segments.filter(s => s.type === 'bar')
      const tocBar = barSegments.find(s => s.type === 'bar' && s.placement === 'post_toc')
      expect(tocBar).toBeDefined()
    })

    it('html before post_toc bar contains the TOC list', () => {
      const segments = splitArticleHtml(makeHtml())
      const tocBarIdx = segments.findIndex(s => s.type === 'bar' && s.placement === 'post_toc')
      const before = segments.slice(0, tocBarIdx)
      const beforeHtml = before
        .filter(s => s.type === 'html')
        .map(s => (s as HtmlSegment).content)
        .join('')
      expect(beforeHtml).toContain('Table of Contents')
      expect(beforeHtml).toContain('</ul>')
    })

    it('html after post_toc bar does not contain the TOC closing ul', () => {
      const segments = splitArticleHtml(makeHtml())
      const tocBarIdx = segments.findIndex(s => s.type === 'bar' && s.placement === 'post_toc')
      const after = segments.slice(tocBarIdx + 1)
      const afterHtml = after
        .filter(s => s.type === 'html')
        .map(s => (s as HtmlSegment).content)
        .join('')
      // The TOC heading itself should not appear after the bar
      expect(afterHtml).not.toContain('Table of Contents')
    })

    it('handles nested TOC lists by finding the outermost closing ul', () => {
      const segments = splitArticleHtml(makeHtml({ nested: true }))
      const tocBar = segments.find(s => s.type === 'bar' && s.placement === 'post_toc')
      expect(tocBar).toBeDefined()
    })
  })

  describe('post_faq_2 placement', () => {
    it('produces a post_faq_2 bar segment after the second FAQ answer', () => {
      const segments = splitArticleHtml(makeHtml())
      const faqBar = segments.find(s => s.type === 'bar' && s.placement === 'post_faq_2')
      expect(faqBar).toBeDefined()
    })

    it('html before post_faq_2 bar contains first and second FAQ questions', () => {
      const segments = splitArticleHtml(makeHtml())
      const faqBarIdx = segments.findIndex(s => s.type === 'bar' && s.placement === 'post_faq_2')
      const before = segments.slice(0, faqBarIdx)
      const beforeHtml = before
        .filter(s => s.type === 'html')
        .map(s => (s as HtmlSegment).content)
        .join('')
      expect(beforeHtml).toContain('Question 1')
      expect(beforeHtml).toContain('Question 2')
    })

    it('html after post_faq_2 bar contains third FAQ question', () => {
      const segments = splitArticleHtml(makeHtml())
      const faqBarIdx = segments.findIndex(s => s.type === 'bar' && s.placement === 'post_faq_2')
      const after = segments.slice(faqBarIdx + 1)
      const afterHtml = after
        .filter(s => s.type === 'html')
        .map(s => (s as HtmlSegment).content)
        .join('')
      expect(afterHtml).toContain('Question 3')
    })
  })

  describe('fallback behaviour', () => {
    it('returns a single html segment if no TOC heading is found', () => {
      const html =
        '<p>No TOC here</p><h2 id="faq"><a href="#faq">Frequently Asked Questions</a></h2><h3 id="q1"><a href="#q1">Q1</a></h3><p>A1</p><h3 id="q2"><a href="#q2">Q2</a></h3><p>A2</p>'
      const segments = splitArticleHtml(html)
      const bars = segments.filter(s => s.type === 'bar' && s.placement === 'post_toc')
      expect(bars.length).toBe(0)
    })

    it('skips post_faq_2 bar if FAQ section has fewer than 2 questions', () => {
      const html = makeHtml({ faqCount: 1 })
      const segments = splitArticleHtml(html)
      const bars = segments.filter(s => s.type === 'bar' && s.placement === 'post_faq_2')
      expect(bars.length).toBe(0)
    })

    it('returns all html as one segment when neither anchor is found', () => {
      const html = '<p>Just a paragraph</p>'
      const segments = splitArticleHtml(html)
      expect(segments).toHaveLength(1)
      expect(segments[0].type).toBe('html')
    })
  })

  describe('segment ordering', () => {
    it('post_toc bar comes before post_faq_2 bar', () => {
      const segments = splitArticleHtml(makeHtml())
      const tocIdx = segments.findIndex(s => s.type === 'bar' && s.placement === 'post_toc')
      const faqIdx = segments.findIndex(s => s.type === 'bar' && s.placement === 'post_faq_2')
      expect(tocIdx).toBeLessThan(faqIdx)
    })

    it('all characters from the original html appear in the segments exactly once', () => {
      const html = makeHtml()
      const segments = splitArticleHtml(html)
      const reconstructed = segments
        .filter(s => s.type === 'html')
        .map(s => (s as HtmlSegment).content)
        .join('')
      expect(reconstructed).toBe(html)
    })
  })
})

describe('splitArticleHtml fallback placement', () => {
  it('injects one fallback bar when the article has no TOC and no FAQ', () => {
    const html = [
      '<h2 id="a"><a href="#a">Background</a></h2>',
      '<p>Paragraph one of the article body.</p>',
      '<p>Paragraph two of the article body.</p>',
      '<h2 id="b"><a href="#b">What To Do Next</a></h2>',
      '<p>Paragraph three of the article body.</p>',
      '<p>Paragraph four of the article body.</p>',
    ].join('')

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')

    expect(bars).toHaveLength(1)
    expect(bars[0]).toEqual({ type: 'bar', placement: 'fallback_mid' })
  })

  it('reassembles to the original html when a fallback bar is injected', () => {
    const html = '<p>One.</p><p>Two.</p><p>Three.</p><p>Four.</p>'
    const segments = splitArticleHtml(html)
    const rejoined = segments
      .filter(s => s.type === 'html')
      .map(s => (s as { content: string }).content)
      .join('')

    expect(rejoined).toBe(html)
  })

  it('does not add a fallback when a TOC bar was already placed', () => {
    const html = [
      '<h2 id="toc"><a href="#toc">Table of Contents</a></h2>',
      '<ul><li>One</li><li>Two</li></ul>',
      '<p>Body paragraph.</p>',
      '<p>Another body paragraph.</p>',
    ].join('')

    const bars = splitArticleHtml(html).filter(s => s.type === 'bar')

    expect(bars).toHaveLength(1)
    expect(bars[0]).toEqual({ type: 'bar', placement: 'post_toc' })
  })

  it('returns no bar when there is no paragraph boundary to split on', () => {
    const html = '<h2 id="a"><a href="#a">Only A Heading</a></h2>'
    const bars = splitArticleHtml(html).filter(s => s.type === 'bar')

    expect(bars).toHaveLength(0)
  })
})

describe('splitArticleHtml fallback placement — boundary hardening', () => {
  /** Count non-overlapping occurrences of a literal substring. */
  const countOccurrences = (haystack: string, needle: string): number =>
    haystack.split(needle).length - 1

  it('does not place the bar inside a <pre>/<code> region, even when that region holds the nearest-to-target "</p>"', () => {
    // A real paragraph boundary close to the start, a <pre><code> block
    // containing a *literal* "</p>" positioned closer to the 45% target than
    // that real boundary, and a second real paragraph at the very end (which
    // is unusable because it leaves no content on the right). Without the
    // guard, findMidParagraphBoundary picks the boundary nearest the target —
    // the one inside the code block — and the bar lands mid-tag.
    const before = `<p>${'A'.repeat(50)}.</p>`
    const codeBlock = `<pre><code>${'x'.repeat(20)}<p>y</p>${'z'.repeat(20)}</code></pre>`
    const after = `<p>${'B'.repeat(50)}.</p>`
    const html = before + codeBlock + after

    const segments = splitArticleHtml(html)
    const barIdx = segments.findIndex(s => s.type === 'bar')
    expect(barIdx).toBeGreaterThan(-1)

    const beforeBarHtml = segments
      .slice(0, barIdx)
      .filter(s => s.type === 'html')
      .map(s => (s as HtmlSegment).content)
      .join('')

    // If the bar landed inside the <pre>/<code> region, the html before it
    // would contain an opening tag with no matching close.
    expect(countOccurrences(beforeBarHtml, '<pre>')).toBe(countOccurrences(beforeBarHtml, '</pre>'))
    expect(countOccurrences(beforeBarHtml, '<code>')).toBe(
      countOccurrences(beforeBarHtml, '</code>')
    )

    const reconstructed = segments
      .filter(s => s.type === 'html')
      .map(s => (s as HtmlSegment).content)
      .join('')
    expect(reconstructed).toBe(html)
  })

  it('places the bar and reassembles correctly when the only "</p>" sits right after the opening content', () => {
    const html =
      `<p>${'X'.repeat(30)}.</p>` +
      `<div>plenty of block content with no more paragraph tags anywhere else in this document, ` +
      `just plain non-paragraph markup that runs on for a while so the string has real length.</div>`

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')
    expect(bars).toHaveLength(1)
    expect(bars[0]).toEqual({ type: 'bar', placement: 'fallback_mid' })

    const reconstructed = segments
      .filter(s => s.type === 'html')
      .map(s => (s as HtmlSegment).content)
      .join('')
    expect(reconstructed).toBe(html)
  })

  it('adds no bar and loses no content when the only "</p>" sits at the very end', () => {
    const html =
      `<div>plenty of block content with no paragraph tags for a good while, so the only ` +
      `paragraph in the whole document ends up right at the very end of the string.</div>` +
      `<p>${'Y'.repeat(20)}.</p>`

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')
    // The only "</p>" boundary is the end of the string itself — no content
    // would remain on the right, so it is not a usable split point.
    expect(bars).toHaveLength(0)

    const reconstructed = segments
      .filter(s => s.type === 'html')
      .map(s => (s as HtmlSegment).content)
      .join('')
    expect(reconstructed).toBe(html)
  })

  it('does not throw and loses no content on unclosed/malformed markup', () => {
    const html =
      '<h2 id="a"><a href="#a">Heading</a></h2>' +
      '<p>This paragraph is never closed and just keeps going with plenty of text but no ' +
      'closing tag ever appears anywhere in this string, which should not cause the function to throw.'

    let segments: ArticleSegment[] = []
    expect(() => {
      segments = splitArticleHtml(html)
    }).not.toThrow()

    const bars = segments.filter(s => s.type === 'bar')
    expect(bars).toHaveLength(0)

    const reconstructed = segments
      .filter(s => s.type === 'html')
      .map(s => (s as HtmlSegment).content)
      .join('')
    expect(reconstructed).toBe(html)
  })

  it('leaves the fallback disengaged in a long article where a later paragraph boundary would otherwise look plausible', () => {
    const html = [
      '<h2 id="toc"><a href="#toc">Table of Contents</a></h2>',
      '<ul><li>One</li><li>Two</li></ul>',
      `<p>${'Body paragraph one. '.repeat(20)}</p>`,
      `<p>${'Body paragraph two. '.repeat(20)}</p>`,
      `<p>${'Body paragraph three. '.repeat(20)}</p>`,
      `<p>${'Body paragraph four. '.repeat(20)}</p>`,
    ].join('')

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')

    expect(bars).toHaveLength(1)
    expect(bars[0]).toEqual({ type: 'bar', placement: 'post_toc' })

    const reconstructed = segments
      .filter(s => s.type === 'html')
      .map(s => (s as HtmlSegment).content)
      .join('')
    expect(reconstructed).toBe(html)
  })
})

describe('splitArticleHtml fallback placement — unclosed <pre>/<code> hardening', () => {
  it('excludes a "</p>" inside an unclosed <pre>, even though it would otherwise be the only usable boundary', () => {
    const html =
      '<h2 id="a"><a href="#a">Heading</a></h2>' +
      '<pre><code>start of a code sample with a literal </p> tag inside it that never gets ' +
      'closed — there is no matching closing pre or code tag anywhere later in this string.'

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')
    // An unterminated <pre> protects everything from its opening tag to the
    // end of the string, so the only "</p>" in this document is unusable.
    expect(bars).toHaveLength(0)

    const reconstructed = segments
      .filter(s => s.type === 'html')
      .map(s => (s as HtmlSegment).content)
      .join('')
    expect(reconstructed).toBe(html)
  })

  it('excludes a "</p>" inside an unclosed <code>, even though it would otherwise be the only usable boundary', () => {
    const html =
      '<h2 id="a"><a href="#a">Heading</a></h2>' +
      '<code>start of an inline-style code run with a literal </p> tag inside it that never ' +
      'gets closed — there is no matching closing code tag anywhere later in this string.'

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')
    expect(bars).toHaveLength(0)

    const reconstructed = segments
      .filter(s => s.type === 'html')
      .map(s => (s as HtmlSegment).content)
      .join('')
    expect(reconstructed).toBe(html)
  })

  it('adds no bar when every candidate boundary is protected, whether by a closed or an unclosed region', () => {
    const html =
      '<h2 id="a"><a href="#a">Heading</a></h2>' +
      `<pre><code>${'x'.repeat(10)}<p>closed-region candidate</p>${'z'.repeat(10)}</code></pre>` +
      '<code>an unclosed code run holding a second literal </p> that also never gets closed.'

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')
    expect(bars).toHaveLength(0)

    const reconstructed = segments
      .filter(s => s.type === 'html')
      .map(s => (s as HtmlSegment).content)
      .join('')
    expect(reconstructed).toBe(html)
  })

  it('still chooses an earlier valid boundary when an unclosed <pre> appears later in the document', () => {
    const html =
      `<p>${'A real paragraph with plenty of body text. '.repeat(4)}</p>` +
      '<pre><code>a later, unclosed code sample containing a literal </p> tag that never gets ' +
      'closed and runs all the way to the end of the string.'

    const segments = splitArticleHtml(html)
    const barIdx = segments.findIndex(s => s.type === 'bar')
    expect(barIdx).toBeGreaterThan(-1)
    expect(segments[barIdx]).toEqual({ type: 'bar', placement: 'fallback_mid' })

    const beforeBarHtml = segments
      .slice(0, barIdx)
      .filter(s => s.type === 'html')
      .map(s => (s as HtmlSegment).content)
      .join('')
    // The chosen boundary must be the real paragraph close, which sits
    // entirely before the unclosed <pre> even opens.
    expect(beforeBarHtml).not.toContain('<pre>')
    expect(beforeBarHtml).not.toContain('<code>')

    const reconstructed = segments
      .filter(s => s.type === 'html')
      .map(s => (s as HtmlSegment).content)
      .join('')
    expect(reconstructed).toBe(html)
  })
})

describe('splitArticleHtml fallback placement — lead-in guard', () => {
  /** Position (length of concatenated html before the bar) of the bar segment, or -1 if none. */
  const barPositionOf = (segments: ArticleSegment[]): number => {
    const barIdx = segments.findIndex(s => s.type === 'bar')
    if (barIdx === -1) return -1
    return segments
      .slice(0, barIdx)
      .filter(s => s.type === 'html')
      .map(s => (s as HtmlSegment).content)
      .reduce((len, c) => len + c.length, 0)
  }

  const reconstruct = (segments: ArticleSegment[]): string =>
    segments
      .filter(s => s.type === 'html')
      .map(s => (s as HtmlSegment).content)
      .join('')

  it('does not orphan a bold-label lead-in from the list it introduces (production shape: "PIP Limits:")', () => {
    const pipParagraph = '<p><strong>PIP Limits:</strong></p>'
    const html = [
      '<h2 id="a"><a href="#a">Uninsured Motorist Coverage</a></h2>',
      `<p>${'Intro filler sentence about the coverage overview here today. '.repeat(3)}</p>`,
      '<ul><li>Prior list item one</li><li>Prior list item two</li></ul>',
      pipParagraph,
      '<ul><li>$10,000 minimum</li><li>$50,000 maximum</li></ul>',
      `<p>${'Trailing filler text after the list, more overall length here today. '.repeat(4)}</p>`,
      '<p>Final closing sentence to end the article body section.</p>',
    ].join('')
    const pipCloseIdx = html.indexOf(pipParagraph) + pipParagraph.length

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')
    expect(bars).toHaveLength(1) // coverage must not regress to zero

    expect(barPositionOf(segments)).not.toBe(pipCloseIdx)
    expect(reconstruct(segments)).toBe(html)
  })

  it('does not orphan a bold-label lead-in with no trailing colon (production shape: "Keep Complete Copies")', () => {
    const leadIn = '<p><strong>Keep Complete Copies</strong></p>'
    const html = [
      '<h2 id="a"><a href="#a">After A Denial</a></h2>',
      `<p>${'Intro filler sentence about what happens after a denial letter arrives. '.repeat(3)}</p>`,
      '<ol><li>Prior step one</li><li>Prior step two</li></ol>',
      leadIn,
      '<ul><li>Copy of the claim denial letter</li><li>Copy of the police report</li></ul>',
      `<p>${'Trailing filler text after the list, more overall length here today. '.repeat(4)}</p>`,
      '<p>Final closing sentence to end the article body section.</p>',
    ].join('')
    const leadInCloseIdx = html.indexOf(leadIn) + leadIn.length

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')
    expect(bars).toHaveLength(1)

    expect(barPositionOf(segments)).not.toBe(leadInCloseIdx)
    expect(reconstruct(segments)).toBe(html)
  })

  it('does not orphan a colon-ending prose lead-in from the list it introduces (production shape: "Practical Reality:")', () => {
    const headingP = '<p><strong>Practical Reality:</strong></p>'
    const leadIn =
      '<p>While the uninsured driver CAN sue you, there are practical considerations:</p>'
    const html = [
      '<h2 id="a"><a href="#a">Being Sued By An Uninsured Driver</a></h2>',
      `<p>${'Intro filler sentence about the general topic of uninsured drivers here. '.repeat(2)}</p>`,
      headingP,
      leadIn,
      '<ul><li>Consideration one</li><li>Consideration two</li></ul>',
      `<p>${'Trailing filler text after the list, more overall length here today. '.repeat(3)}</p>`,
      '<p>Final closing sentence to end the article body section.</p>',
    ].join('')
    const leadInCloseIdx = html.indexOf(leadIn) + leadIn.length

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')
    expect(bars).toHaveLength(1)

    expect(barPositionOf(segments)).not.toBe(leadInCloseIdx)
    expect(reconstruct(segments)).toBe(html)
  })

  it('prefers a suitable boundary further from the target over a nearer lead-in', () => {
    const leadIn = '<p><strong>Label:</strong></p>'
    const html = [
      '<h2 id="a"><a href="#a">Heading</a></h2>',
      `<p>${'Filler before the lead-in to give the target something nearby to land on. '.repeat(2)}</p>`,
      leadIn,
      '<ul><li>Item one</li><li>Item two</li></ul>',
      `<p>${'Filler after the list so a later suitable boundary exists further out today. '.repeat(3)}</p>`,
      '<p>Final closing sentence to end the article body section.</p>',
    ].join('')

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')
    expect(bars).toHaveLength(1)

    // The lead-in boundary (225) sits closer to the 45% target than the
    // earlier suitable boundary (195), but must be skipped anyway.
    expect(barPositionOf(segments)).toBe(195)
    expect(reconstruct(segments)).toBe(html)
  })

  it('falls back to the nearest candidate, unchanged, when every candidate is a lead-in', () => {
    const html = [
      '<h2 id="a"><a href="#a">Labels</a></h2>',
      '<p><strong>Label One:</strong></p>',
      '<div>Non-paragraph filler content that keeps overall length up without adding p tags here.</div>',
      '<p><strong>Label Two:</strong></p>',
      '<div>More non-paragraph filler content to keep the overall length up appropriately as well.</div>',
      '<p><strong>Label Three:</strong></p>',
      '<div>Trailing filler content after the last label to keep it away from the very end here.</div>',
    ].join('')

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')
    // A slightly awkward placement beats no form at all — coverage must not regress.
    expect(bars).toHaveLength(1)
    expect(reconstruct(segments)).toBe(html)
  })

  it('does not affect placement between two ordinary narrative paragraphs (no lead-in present)', () => {
    const html = [
      '<h2 id="a"><a href="#a">How To File A Claim</a></h2>',
      `<p>${'First, call your insurance company and explain the situation in careful detail. '.repeat(2)}</p>`,
      `<p>${'Second, gather the paperwork the adjuster will need to process your claim quickly. '.repeat(2)}</p>`,
      `<p>${'Third, follow up in writing so there is a clear record of every step you took. '.repeat(2)}</p>`,
    ].join('')

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')
    expect(bars).toHaveLength(1)
    expect(barPositionOf(segments)).toBe(219)
    expect(reconstruct(segments)).toBe(html)
  })

  it('does not treat a paragraph with an inline <strong> phrase (not the whole paragraph) as a lead-in', () => {
    const mixed =
      '<p>According to <strong>state law</strong>, you must respond within 30 days of the letter.</p>'
    const html = [
      '<h2 id="a"><a href="#a">Deadlines</a></h2>',
      `<p>${'Intro filler sentence describing deadlines in general terms before specifics here. '.repeat(1)}</p>`,
      mixed,
      `<p>${'Closing filler sentence describing what happens after the deadline passes here today. '.repeat(2)}</p>`,
    ].join('')
    const mixedCloseIdx = html.indexOf(mixed) + mixed.length

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')
    expect(bars).toHaveLength(1)
    // The mixed-content paragraph is the nearest boundary and is NOT a
    // lead-in, so it should still be chosen.
    expect(barPositionOf(segments)).toBe(mixedCloseIdx)
    expect(reconstruct(segments)).toBe(html)
  })

  it('rejects a colon-ending lead-in even when nothing after it is a list', () => {
    const leadIn = '<p>Here are the key points to remember:</p>'
    const html = [
      '<h2 id="a"><a href="#a">Key Points</a></h2>',
      `<p>${'Filler before the colon lead-in to give the target something nearby to land on. '.repeat(1)}</p>`,
      leadIn,
      `<p>${'Plain prose paragraph that follows the lead-in instead of a list, with more text. '.repeat(2)}</p>`,
    ].join('')
    const leadInCloseIdx = html.indexOf(leadIn) + leadIn.length

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')
    expect(bars).toHaveLength(1)
    expect(barPositionOf(segments)).not.toBe(leadInCloseIdx)
    expect(barPositionOf(segments)).toBe(130)
    expect(reconstruct(segments)).toBe(html)
  })

  it('rejects a candidate followed by a list even when the paragraph before it is not worded as a lead-in', () => {
    const para =
      '<p>Ordinary paragraph text that ends with a period, not a colon or bold label at all.</p>'
    const html = [
      '<h2 id="a"><a href="#a">Ordinary Section</a></h2>',
      `<p>${'Filler before the ordinary paragraph to give the target something nearby to land on. '.repeat(1)}</p>`,
      para,
      '<ul><li>Item one</li><li>Item two</li></ul>',
      `<p>${'Trailing paragraph after the list to give a later candidate as well, with more length. '.repeat(2)}</p>`,
    ].join('')
    const paraCloseIdx = html.indexOf(para) + para.length

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')
    expect(bars).toHaveLength(1)
    expect(barPositionOf(segments)).not.toBe(paraCloseIdx)
    expect(barPositionOf(segments)).toBe(141)
    expect(reconstruct(segments)).toBe(html)
  })
})

describe('splitArticleHtml fallback placement — nesting-depth guard', () => {
  const barPositionOf = (segments: ArticleSegment[]): number => {
    const barIdx = segments.findIndex(s => s.type === 'bar')
    if (barIdx === -1) return -1
    return segments
      .slice(0, barIdx)
      .filter(s => s.type === 'html')
      .map(s => (s as HtmlSegment).content)
      .reduce((len, c) => len + c.length, 0)
  }

  const reconstruct = (segments: ArticleSegment[]): string =>
    segments
      .filter(s => s.type === 'html')
      .map(s => (s as HtmlSegment).content)
      .join('')

  it('does not split a <blockquote> containing two paragraphs', () => {
    const q1 = '<p>First quoted paragraph with some length to it for the reader. </p>'
    const q2 = '<p>Second quoted paragraph continuing the same quotation for the reader today.</p>'
    const html = [
      '<h2 id="a"><a href="#a">Heading</a></h2>',
      `<p>${'Intro filler text before the quote to give the target something nearby today. '.repeat(2)}</p>`,
      `<blockquote>${q1}${q2}</blockquote>`,
      `<p>${'Filler text after the blockquote to give a further candidate boundary as well. '.repeat(2)}</p>`,
    ].join('')
    const q1CloseIdx = html.indexOf(q1) + q1.length
    const q2CloseIdx = html.indexOf(q2) + q2.length

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')
    expect(bars).toHaveLength(1)

    const barPos = barPositionOf(segments)
    expect(barPos).not.toBe(q1CloseIdx)
    expect(barPos).not.toBe(q2CloseIdx)

    // The blockquote must appear whole in whichever side it lands on.
    const before = segments
      .slice(
        0,
        segments.findIndex(s => s.type === 'bar')
      )
      .filter(s => s.type === 'html')
      .map(s => (s as HtmlSegment).content)
      .join('')
    const hasOpenTag = before.includes('<blockquote>')
    const hasCloseTag = before.includes('</blockquote>')
    expect(hasOpenTag).toBe(hasCloseTag) // both present or both absent — never split mid-tag

    expect(reconstruct(segments)).toBe(html)
  })

  it('does not split a loose <ol> whose <li>s contain <p> paragraphs', () => {
    const item1 = '<p>First loose item paragraph text describing step one in detail today.</p>'
    const item2 = '<p>Second loose item paragraph text describing step two in detail today.</p>'
    const html = [
      '<h2 id="a"><a href="#a">Heading</a></h2>',
      `<p>${'Intro filler text before the list to give the target something nearby today. '.repeat(2)}</p>`,
      `<ol><li>${item1}</li><li>${item2}</li></ol>`,
      `<p>${'Filler text after the list to give a further candidate boundary as well here. '.repeat(2)}</p>`,
    ].join('')
    const item1CloseIdx = html.indexOf(item1) + item1.length
    const item2CloseIdx = html.indexOf(item2) + item2.length

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')
    expect(bars).toHaveLength(1)

    const barPos = barPositionOf(segments)
    expect(barPos).not.toBe(item1CloseIdx)
    expect(barPos).not.toBe(item2CloseIdx)

    const before = segments
      .slice(
        0,
        segments.findIndex(s => s.type === 'bar')
      )
      .filter(s => s.type === 'html')
      .map(s => (s as HtmlSegment).content)
      .join('')
    expect(before.includes('<ol>')).toBe(before.includes('</ol>'))

    expect(reconstruct(segments)).toBe(html)
  })

  it('does not split a nested <ul> inside an <li>', () => {
    const outerP = '<p>Item one text describing the first bullet point in some further detail.</p>'
    const nestedP = '<p>Nested sub item elaborating on item one with more specific detail here.</p>'
    const html = [
      '<h2 id="a"><a href="#a">Heading</a></h2>',
      `<p>${'Intro filler text before the nested list to give the target something nearby. '.repeat(2)}</p>`,
      `<ul><li>${outerP}<ul><li>${nestedP}</li></ul></li></ul>`,
      `<p>${'Filler text after the nested list to give a further candidate boundary here. '.repeat(2)}</p>`,
    ].join('')
    const outerCloseIdx = html.indexOf(outerP) + outerP.length
    const nestedCloseIdx = html.indexOf(nestedP) + nestedP.length

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')
    expect(bars).toHaveLength(1)

    const barPos = barPositionOf(segments)
    expect(barPos).not.toBe(outerCloseIdx)
    expect(barPos).not.toBe(nestedCloseIdx)

    expect(reconstruct(segments)).toBe(html)
  })

  it('still places a form when every candidate boundary is inside a <blockquote> (no coverage regression)', () => {
    const html = [
      '<h2 id="a"><a href="#a">Heading</a></h2>',
      '<blockquote><p>Only quoted paragraph text that exists as a boundary candidate in this doc.</p>' +
        '<p>Second quoted paragraph so there is content on both sides of the candidate today.</p></blockquote>',
    ].join('')

    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')
    // A form landing inside the blockquote is still better than no form at all.
    expect(bars).toHaveLength(1)
    expect(reconstruct(segments)).toBe(html)
  })
})
