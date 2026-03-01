import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeStringify from 'rehype-stringify'
import { preprocessMarkdown } from './markdown-preprocess'

/**
 * Process special link formats in markdown:
 * - INTERNAL:/path -> /path
 * - EXTERNAL:domain.com -> https://domain.com
 */
function processSpecialLinks(markdown: string): string {
  // Replace INTERNAL: links with proper internal paths
  let processed = markdown.replace(/\(INTERNAL:([^)]+)\)/g, '($1)')

  // Replace EXTERNAL: links with proper HTTPS URLs
  processed = processed.replace(/\(EXTERNAL:([^)]+)\)/g, (match, url) => {
    // Add https:// if not already present
    const fullUrl = url.startsWith('http') ? url : `https://${url}`
    return `(${fullUrl})`
  })

  return processed
}

export async function markdownToHtml(markdown: string): Promise<string> {
  // Strip frontmatter and KB creator artifacts, then process special links
  const processedMarkdown = processSpecialLinks(preprocessMarkdown(markdown))

  const result = await unified()
    .use(remarkParse) // Parse markdown
    .use(remarkGfm) // Support tables, task lists, etc.
    .use(remarkRehype) // Convert to HTML
    .use(rehypeSlug) // Add IDs to headings
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' }) // Make headings clickable
    .use(rehypeHighlight) // Syntax highlighting
    .use(rehypeStringify) // Stringify to HTML
    .process(processedMarkdown)

  return result.toString()
}
