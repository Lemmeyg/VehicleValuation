/**
 * Tests for lib/markdown.ts — preprocessMarkdown
 *
 * Verifies that YAML frontmatter and stray <hyperlink> tags from the KB
 * creator are stripped before conversion, so they don't leak into rendered HTML.
 */

import { preprocessMarkdown } from '../../lib/markdown-preprocess'

describe('preprocessMarkdown — frontmatter and artifact stripping', () => {
  it('strips YAML frontmatter', () => {
    const input = `---
title: 'Test Article'
description: 'A test article description'
category: 'Insurance Guides'
---

# Test Heading

Some article content here.`

    const result = preprocessMarkdown(input)

    expect(result).not.toContain('title:')
    expect(result).not.toContain('description:')
    expect(result).not.toContain('category:')
    // The leading # H1 is intentionally stripped — the page template renders
    // the title in its own <h1> (avoids a duplicate-h1 SEO penalty).
    expect(result).not.toContain('# Test Heading')
    expect(result).toContain('Some article content here.')
  })

  it('strips frontmatter with Windows-style CRLF line endings', () => {
    const input =
      "\r\n---\r\ntitle: 'Total Loss Settlement'\r\nauthor: 'TotalLossToolKit.Com'\r\n---\r\n\r\n# Article Title\r\n\r\nContent paragraph."

    const result = preprocessMarkdown(input)

    expect(result).not.toContain('title:')
    expect(result).not.toContain('author:')
    expect(result).not.toContain('# Article Title') // leading H1 stripped by design
    expect(result).toContain('Content paragraph.')
  })

  it('strips stray <hyperlink> tags left by the KB creator', () => {
    const input = `# Article Title

<hyperlink>some-article-slug</hyperlink>

Article content here.`

    const result = preprocessMarkdown(input)

    expect(result).not.toContain('<hyperlink>')
    expect(result).not.toContain('some-article-slug')
    expect(result).not.toContain('# Article Title') // leading H1 stripped by design
    expect(result).toContain('Article content here.')
  })

  it('strips both frontmatter and hyperlink tag when both are present', () => {
    const input = `\r\n---\r\ntitle: 'Buy Back Your Totaled Car'\r\nseoScore: 86\r\n---\r\n\r\n<hyperlink>should-you-buy-back-your-totaled-car</hyperlink>\r\n\r\n# Buy Back Your Totaled Car\r\n\r\nArticle content.`

    const result = preprocessMarkdown(input)

    expect(result).not.toContain('seoScore')
    expect(result).not.toContain('<hyperlink>')
    expect(result).not.toContain('should-you-buy-back-your-totaled-car')
    expect(result).not.toContain('# Buy Back Your Totaled Car') // leading H1 stripped by design
    expect(result).toContain('Article content.')
  })

  it('strips the leading H1 even when there is no frontmatter', () => {
    const input = `# Normal Article

No frontmatter here, just regular markdown.`

    const result = preprocessMarkdown(input)

    expect(result).not.toContain('# Normal Article') // leading H1 stripped by design
    expect(result).toContain('No frontmatter here')
  })
})

import { transformHeroFormLinks } from '../../lib/markdown-transform'

describe('transformHeroFormLinks', () => {
  const HERO_URL = 'https://totallosstoolkit.com/#hero-form'

  it('replaces first standalone /#hero-form paragraph with callout box', () => {
    const html = `<p>Some content before.</p>
<p><a href="${HERO_URL}">Check your vehicle value</a></p>
<p>Some content after.</p>`

    const result = transformHeroFormLinks(html)

    expect(result).toContain('class="hero-form-callout"')
    expect(result).toContain('hero-form-callout__btn')
    expect(result).toContain('Check your vehicle value')
    expect(result).not.toMatch(/<p><a href="[^"]*#hero-form"/)
    expect(result).toContain('<p>Some content before.</p>')
    expect(result).toContain('<p>Some content after.</p>')
  })

  it('replaces second standalone /#hero-form paragraph with callout box', () => {
    const html = `<p><a href="${HERO_URL}">First link</a></p>
<p>Middle paragraph.</p>
<p><a href="${HERO_URL}">Second link</a></p>`

    const result = transformHeroFormLinks(html)
    const calloutCount = (result.match(/class="hero-form-callout"/g) || []).length

    expect(calloutCount).toBe(2)
    expect(result).toContain('First link')
    expect(result).toContain('Second link')
  })

  it('turns 3rd standalone /#hero-form paragraph into inline styled link', () => {
    const html = `<p><a href="${HERO_URL}">First</a></p>
<p><a href="${HERO_URL}">Second</a></p>
<p><a href="${HERO_URL}">Third</a></p>`

    const result = transformHeroFormLinks(html)
    const calloutCount = (result.match(/class="hero-form-callout"/g) || []).length

    expect(calloutCount).toBe(2)
    expect(result).toContain('hero-form-cta-inline')
    expect(result).toContain('Third')
  })

  it('adds hero-form-cta-inline class to inline (non-standalone) /#hero-form links', () => {
    const html = `<p>To check your value, <a href="${HERO_URL}">use our tool</a> now.</p>`

    const result = transformHeroFormLinks(html)

    expect(result).not.toContain('class="hero-form-callout"')
    expect(result).toContain('hero-form-cta-inline')
    expect(result).toContain('use our tool')
    // Surrounding text preserved
    expect(result).toContain('To check your value,')
    expect(result).toContain('now.')
  })

  it('does not modify articles with no /#hero-form links', () => {
    const html = `<p>Some content.</p>
<p><a href="https://totallosstoolkit.com/directory">Find an expert</a></p>`

    const result = transformHeroFormLinks(html)

    expect(result).toBe(html)
  })

  it('does not modify non-hero-form anchor tags', () => {
    const html = `<p><a href="https://totallosstoolkit.com/knowledge-base/some-article">Read more</a></p>`

    const result = transformHeroFormLinks(html)

    expect(result).toBe(html)
  })

  it('callout box contains fixed heading and body text', () => {
    const html = `<p><a href="${HERO_URL}">Get valuation</a></p>`

    const result = transformHeroFormLinks(html)

    expect(result).toContain('hero-form-callout__title')
    expect(result).toContain('hero-form-callout__body')
    expect(result).toContain('Check Your Vehicle')
  })
})
