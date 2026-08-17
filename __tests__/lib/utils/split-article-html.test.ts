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
