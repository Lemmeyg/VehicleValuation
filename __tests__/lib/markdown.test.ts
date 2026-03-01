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
    expect(result).toContain('# Test Heading')
    expect(result).toContain('Some article content here.')
  })

  it('strips frontmatter with Windows-style CRLF line endings', () => {
    const input =
      "\r\n---\r\ntitle: 'Total Loss Settlement'\r\nauthor: 'TotalLossToolKit.Com'\r\n---\r\n\r\n# Article Title\r\n\r\nContent paragraph."

    const result = preprocessMarkdown(input)

    expect(result).not.toContain('title:')
    expect(result).not.toContain('author:')
    expect(result).toContain('# Article Title')
    expect(result).toContain('Content paragraph.')
  })

  it('strips stray <hyperlink> tags left by the KB creator', () => {
    const input = `# Article Title

<hyperlink>some-article-slug</hyperlink>

Article content here.`

    const result = preprocessMarkdown(input)

    expect(result).not.toContain('<hyperlink>')
    expect(result).not.toContain('some-article-slug')
    expect(result).toContain('# Article Title')
    expect(result).toContain('Article content here.')
  })

  it('strips both frontmatter and hyperlink tag when both are present', () => {
    const input = `\r\n---\r\ntitle: 'Buy Back Your Totaled Car'\r\nseoScore: 86\r\n---\r\n\r\n<hyperlink>should-you-buy-back-your-totaled-car</hyperlink>\r\n\r\n# Buy Back Your Totaled Car\r\n\r\nArticle content.`

    const result = preprocessMarkdown(input)

    expect(result).not.toContain('seoScore')
    expect(result).not.toContain('<hyperlink>')
    expect(result).not.toContain('should-you-buy-back-your-totaled-car')
    expect(result).toContain('# Buy Back Your Totaled Car')
    expect(result).toContain('Article content.')
  })

  it('leaves content without frontmatter unchanged', () => {
    const input = `# Normal Article

No frontmatter here, just regular markdown.`

    const result = preprocessMarkdown(input)

    expect(result).toContain('# Normal Article')
    expect(result).toContain('No frontmatter here')
  })
})
