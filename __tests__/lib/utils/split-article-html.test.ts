/**
 * Tests for splitArticleHtml utility
 *
 * Verifies the HTML string is split correctly at the TOC end
 * and after the second FAQ answer, returning typed segments.
 */
import { splitArticleHtml, HtmlSegment } from '@/lib/utils/split-article-html'

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
