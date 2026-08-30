import { preprocessMarkdown } from './markdown-preprocess'
import { transformHeroFormLinks } from './markdown-transform'

// Re-export so consumers can import from 'lib/markdown' directly
export { transformHeroFormLinks }

/**
 * The `unified` / remark / rehype ecosystem is ESM-only. Importing it at the top
 * of this file means any module that so much as imports `lib/markdown` (e.g.
 * `lib/suppliers-db`) drags the ESM graph in — which Jest, via `next/jest`,
 * cannot transform, so those test files fail to parse. Loading the pipeline
 * lazily on first use keeps `import`-only consumers (and their tests) clear of
 * the ESM graph entirely. `import()` caches the module, and the Promise below is
 * memoised, so the ecosystem loads at most once per process.
 */
let pipelineModules: ReturnType<typeof loadPipelineModules> | null = null

function loadPipelineModules() {
  return Promise.all([
    import('unified'),
    import('remark-parse'),
    import('remark-gfm'),
    import('remark-rehype'),
    import('rehype-highlight'),
    import('rehype-slug'),
    import('rehype-autolink-headings'),
    import('rehype-stringify'),
  ]).then(([u, rParse, rGfm, rRehype, rHighlight, rSlug, rAutolink, rStringify]) => ({
    unified: u.unified,
    remarkParse: rParse.default,
    remarkGfm: rGfm.default,
    remarkRehype: rRehype.default,
    rehypeHighlight: rHighlight.default,
    rehypeSlug: rSlug.default,
    rehypeAutolinkHeadings: rAutolink.default,
    rehypeStringify: rStringify.default,
  }))
}

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

  pipelineModules ??= loadPipelineModules()
  const {
    unified,
    remarkParse,
    remarkGfm,
    remarkRehype,
    rehypeHighlight,
    rehypeSlug,
    rehypeAutolinkHeadings,
    rehypeStringify,
  } = await pipelineModules

  const result = await unified()
    .use(remarkParse) // Parse markdown
    .use(remarkGfm) // Support tables, task lists, etc.
    .use(remarkRehype) // Convert to HTML
    .use(rehypeSlug) // Add IDs to headings
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' }) // Make headings clickable
    .use(rehypeHighlight) // Syntax highlighting
    .use(rehypeStringify) // Stringify to HTML
    .process(processedMarkdown)

  return transformHeroFormLinks(result.toString())
}
