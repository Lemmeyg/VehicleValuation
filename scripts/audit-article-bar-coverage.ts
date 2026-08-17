/**
 * Audit: how many published KB articles actually render a report form?
 *
 * ArticleReportBar is injected by splitArticleHtml() at two conditional anchor
 * points (a "Table of Contents" heading, and the second FAQ question). An article
 * with neither shape renders no form at all. This counts them.
 *
 * Schema note: the `articles` table (see supabase/migrations/20241221000000_
 * create_content_management.sql and lib/knowledge-base-db.ts) has no `status`
 * column. Published/unpublished is tracked by a boolean `published` column.
 * This script filters on `.eq('published', true)`, matching every read path in
 * lib/knowledge-base-db.ts (getAllArticles, getArticleBySlugStatic, etc.).
 *
 * Run: npx tsx scripts/audit-article-bar-coverage.ts
 */
import { createClient } from '@supabase/supabase-js'
import { markdownToHtml } from '../lib/markdown'
import { splitArticleHtml } from '../lib/utils/split-article-html'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

async function main() {
  const supabase = createClient(supabaseUrl!, supabaseKey!)

  const { data: articles, error } = await supabase
    .from('articles')
    .select('slug, title, category, content, published')
    .eq('published', true)

  if (error) {
    console.error('Supabase query failed:', error)
    process.exit(1)
  }
  if (!articles) {
    console.error('No articles returned')
    process.exit(1)
  }

  const rows: { slug: string; category: string; bars: number; placements: string }[] = []

  for (const article of articles) {
    const html = await markdownToHtml(article.content)
    const segments = splitArticleHtml(html)
    const bars = segments.filter(s => s.type === 'bar')
    rows.push({
      slug: article.slug,
      category: article.category ?? '(none)',
      bars: bars.length,
      placements: bars.map(b => (b as { placement: string }).placement).join('+') || '-',
    })
  }

  const zero = rows.filter(r => r.bars === 0)
  const one = rows.filter(r => r.bars === 1)
  const two = rows.filter(r => r.bars === 2)

  console.log(`\nPublished articles audited: ${rows.length}`)
  console.log(`  0 forms: ${zero.length}  (${((zero.length / rows.length) * 100).toFixed(1)}%)`)
  console.log(`  1 form:  ${one.length}`)
  console.log(`  2 forms: ${two.length}`)

  if (zero.length > 0) {
    console.log(`\nArticles rendering NO report form:`)
    for (const r of zero) console.log(`  - ${r.slug}  [${r.category}]`)
  }

  console.log(`\nFull table (slug, category, bars, placements):`)
  for (const r of rows.sort((a, b) => a.bars - b.bars)) {
    console.log(`${r.bars}  ${r.slug}  [${r.category}]  ${r.placements}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
