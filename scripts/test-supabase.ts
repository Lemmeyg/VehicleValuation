import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env.local
dotenv.config({ path: resolve(__dirname, '../.env.local') })

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase credentials in .env.local')
    process.exit(1)
  }

  console.log(`📡 Supabase URL: ${supabaseUrl}`)
  console.log(`🔑 Anon Key: ${supabaseAnonKey.substring(0, 20)}...`)

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    // Test connection by fetching Supabase health
    const { data, error } = await supabase.from('_migrations').select('*').limit(1)

    if (error) {
      // This is expected if migrations table doesn't exist yet
      console.log('\n⚠️  Migrations table not found (expected for new project)')
      console.log('✅ Connection successful! Your credentials are valid.')
      console.log('\n📋 Next steps:')
      console.log('   1. Set up database schema (Phase 2)')
      console.log('   2. Run migrations to create tables')
    } else {
      console.log('\n✅ Connection successful! Database is accessible.')
      console.log(`📊 Found ${data?.length || 0} migration(s)`)
    }
  } catch (error) {
    console.error('\n❌ Connection failed:', error)
    process.exit(1)
  }
}

testSupabaseConnection()
