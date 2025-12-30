/**
 * Test script to check articles in database
 * Run with: npx tsx test-db-articles.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { supabase } from './lib/db/supabase'

async function testArticles() {
  console.log('🔍 Checking articles in database...\n')

  // Test 1: Check total count
  const { data: articles, error } = await supabase
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Error fetching articles:', error)
    return
  }

  console.log(`✅ Total articles in database: ${articles?.length || 0}\n`)

  if (!articles || articles.length === 0) {
    console.log('⚠️  No articles found in database')
    console.log('   Have you uploaded any articles yet?')
    return
  }

  // Test 2: Show article details
  console.log('📄 Articles found:\n')
  articles.forEach((article, index) => {
    console.log(`${index + 1}. ${article.title}`)
    console.log(`   Slug: ${article.slug}`)
    console.log(`   Category: ${article.category}`)
    console.log(`   Published: ${article.published}`)
    console.log(`   Created: ${article.created_at}`)
    console.log(`   Storage: ${article.storage_path}`)
    console.log('')
  })

  // Test 3: Check published articles
  const { data: published } = await supabase
    .from('articles')
    .select('slug')
    .eq('published', true)

  console.log(`✅ Published articles: ${published?.length || 0}`)

  // Test 4: Test getAllArticles function
  console.log('\n🧪 Testing getAllArticles() function...')
  const { getAllArticles } = await import('./lib/knowledge-base-db')

  try {
    const articlesFromFunction = await getAllArticles()
    console.log(`✅ getAllArticles() returned: ${articlesFromFunction.length} articles`)

    if (articlesFromFunction.length > 0) {
      console.log('\nFirst article from getAllArticles():')
      console.log(JSON.stringify(articlesFromFunction[0], null, 2))
    }
  } catch (err) {
    console.error('❌ Error calling getAllArticles():', err)
  }

  // Test 5: Test static function
  console.log('\n🧪 Testing getAllArticleSlugs() function...')
  const { getAllArticleSlugs } = await import('./lib/knowledge-base-db')

  try {
    const slugs = await getAllArticleSlugs()
    console.log(`✅ getAllArticleSlugs() returned: ${slugs.length} slugs`)
    console.log('Slugs:', slugs)
  } catch (err) {
    console.error('❌ Error calling getAllArticleSlugs():', err)
  }
}

testArticles()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test failed:', err)
    process.exit(1)
  })
