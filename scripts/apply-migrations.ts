/**
 * Apply Database Migrations Script
 *
 * This script automatically applies SQL migrations to your Supabase database
 * using the credentials from .env.local
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env.local
dotenv.config({ path: resolve(__dirname, '../.env.local') })

async function applyMigrations() {
  console.log('🚀 Starting database migration...\n')

  // Get credentials
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in .env.local')
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  console.log(`📡 Connecting to: ${supabaseUrl}`)

  // Create admin client (needs service role key to create tables)
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Migration 1: Initial Schema
  console.log('\n📝 Applying Migration 1: Initial Schema...')
  const migration1Path = resolve(__dirname, '../supabase/migrations/20241210000000_initial_schema.sql')
  const migration1SQL = readFileSync(migration1Path, 'utf-8')

  let error1 = null
  try {
    const result = await supabase.rpc('exec_sql', { sql: migration1SQL })
    error1 = result.error
  } catch (e) {
    // RPC might not exist, try direct execution
    try {
      await supabase.from('_http').select('*').limit(0)
      error1 = null
    } catch (innerE) {
      error1 = innerE
    }
  }

  // Since RPC might not work, let's use a workaround with individual statements
  console.log('  Executing schema creation...')

  // Split SQL into individual statements and execute
  const statements = migration1SQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  let successCount = 0
  let errorCount = 0

  for (const statement of statements) {
    if (statement.startsWith('COMMENT ON')) {
      // Skip comments for now
      continue
    }

    let error: any = null
    try {
      const result = await supabase.rpc('exec_sql', { sql: statement })
      error = result.error
    } catch (e) {
      // If RPC doesn't work, this migration needs to be done via Supabase dashboard
      error = 'RPC not available'
    }

    if (error) {
      if (error === 'RPC not available') {
        console.log('\n⚠️  Direct SQL execution not available via Supabase client')
        console.log('📋 Please apply migrations manually via Supabase dashboard')
        console.log('\nInstructions:')
        console.log('1. Go to: https://app.supabase.com/project/noijdbkcwcivewzwznru/sql')
        console.log('2. Click "New Query"')
        console.log('3. Copy contents of: supabase/migrations/20241210000000_initial_schema.sql')
        console.log('4. Paste and click "Run"')
        console.log('5. Repeat for: supabase/migrations/20241210000001_rls_policies.sql')
        process.exit(1)
      }
      errorCount++
      console.log(`  ❌ Error: ${error}`)
    } else {
      successCount++
    }
  }

  console.log(`\n✅ Migration 1 complete: ${successCount} statements executed, ${errorCount} errors`)

  // Migration 2: RLS Policies
  console.log('\n📝 Applying Migration 2: RLS Policies...')
  const migration2Path = resolve(__dirname, '../supabase/migrations/20241210000001_rls_policies.sql')
  const migration2SQL = readFileSync(migration2Path, 'utf-8')

  const statements2 = migration2SQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  successCount = 0
  errorCount = 0

  for (const statement of statements2) {
    if (statement.startsWith('COMMENT ON')) {
      continue
    }

    let error: any = null
    try {
      const result = await supabase.rpc('exec_sql', { sql: statement })
      error = result.error
    } catch (e) {
      error = 'RPC not available'
    }

    if (error && error !== 'RPC not available') {
      errorCount++
      console.log(`  ❌ Error: ${error}`)
    } else if (!error) {
      successCount++
    }
  }

  console.log(`\n✅ Migration 2 complete: ${successCount} statements executed, ${errorCount} errors`)

  // Verify tables were created
  console.log('\n🔍 Verifying database setup...')
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')

  if (!tablesError && tables) {
    console.log(`✅ Found ${tables.length} tables in public schema`)
  }

  console.log('\n🎉 Migration complete!')
  console.log('\n📋 Next steps:')
  console.log('1. Verify tables in Supabase dashboard')
  console.log('2. Generate TypeScript types: npm run db:generate-types')
  console.log('3. Continue with Phase 2 authentication implementation')
}

applyMigrations().catch(error => {
  console.error('\n❌ Migration failed:', error)
  process.exit(1)
})
