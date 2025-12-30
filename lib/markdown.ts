import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeStringify from 'rehype-stringify'

export async function markdownToHtml(markdown: string): Promise<string> {
  const result = await unified()
    .use(remarkParse) // Parse markdown
    .use(remarkGfm) // Support tables, task lists, etc.
    .use(remarkRehype) // Convert to HTML
    .use(rehypeSlug) // Add IDs to headings
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' }) // Make headings clickable
    .use(rehypeHighlight) // Syntax highlighting
    .use(rehypeStringify) // Stringify to HTML
    .process(markdown)

  return result.toString()
}
