/**
 * Setup Supabase Storage Bucket
 *
 * This script verifies and creates the 'knowledge-base-content' storage bucket
 * Run with: npx tsx scripts/setup-storage-bucket.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const BUCKETS = [
  {
    name: 'knowledge-base-content',
    public: true,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['text/markdown', 'text/plain'],
  },
  {
    name: 'vehicle-reports',
    public: true,
    fileSizeLimit: 10485760, // 10MB
    allowedMimeTypes: ['application/pdf'],
  },
]

async function setupStorageBucket() {
  console.log('🚀 Starting storage bucket setup...\n')

  // Verify environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables:')
    console.error('   - NEXT_PUBLIC_SUPABASE_URL')
    console.error('   - SUPABASE_SERVICE_ROLE_KEY')
    console.error('\nPlease add these to your .env.local file')
    process.exit(1)
  }

  // Create Supabase client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  console.log('✅ Connected to Supabase\n')

  try {
    // Get list of existing buckets
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      console.error('❌ Error listing buckets:', listError.message)
      process.exit(1)
    }

    // Setup each bucket
    for (const bucketConfig of BUCKETS) {
      console.log(`\n🔍 Checking bucket '${bucketConfig.name}'...`)

      const bucketExists = existingBuckets?.some(bucket => bucket.name === bucketConfig.name)

      if (bucketExists) {
        console.log(`✅ Bucket '${bucketConfig.name}' already exists`)

        // Get bucket details
        const bucket = existingBuckets?.find(b => b.name === bucketConfig.name)
        console.log('📋 Details:')
        console.log(`   - ID: ${bucket?.id}`)
        console.log(`   - Public: ${bucket?.public}`)
        console.log(`   - Created: ${bucket?.created_at}`)

        if (!bucket?.public) {
          console.log('⚠️  WARNING: Bucket is not public!')
          console.log('   To make it public:')
          console.log(`   - Go to Supabase Dashboard > Storage > ${bucketConfig.name}`)
          console.log('   - Click Settings > Make bucket public')
        }
      } else {
        console.log(`📦 Creating bucket '${bucketConfig.name}'...`)

        const { error: createError } = await supabase.storage.createBucket(
          bucketConfig.name,
          {
            public: bucketConfig.public,
            fileSizeLimit: bucketConfig.fileSizeLimit,
            allowedMimeTypes: bucketConfig.allowedMimeTypes,
          }
        )

        if (createError) {
          console.error(`❌ Error creating bucket '${bucketConfig.name}':`, createError.message)
          console.error('   Continuing with remaining buckets...')
          continue
        }

        console.log(`✅ Bucket '${bucketConfig.name}' created successfully!`)
        console.log('📋 Details:')
        console.log(`   - Name: ${bucketConfig.name}`)
        console.log(`   - Public: ${bucketConfig.public}`)
        console.log(`   - Max file size: ${(bucketConfig.fileSizeLimit / 1048576).toFixed(0)}MB`)
        console.log(`   - Allowed types: ${bucketConfig.allowedMimeTypes.join(', ')}`)
      }
    }

    console.log('\n🎉 Storage bucket setup complete!\n')
    console.log('📝 Next steps:')
    console.log('1. For knowledge-base-content:')
    console.log('   - Upload markdown files via /admin/knowledge-base/upload')
    console.log('2. For vehicle-reports:')
    console.log('   - PDF reports will be automatically generated and uploaded')
    console.log('   - Users can download their reports from the report view page\n')
    console.log('⚠️  Important: Configure RLS policies in Supabase Dashboard if needed')
    console.log('   - Go to Storage > [bucket-name] > Policies')
    console.log('   - See supabase/migrations/20260111000000_create_vehicle_reports_bucket.sql for policy examples\n')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

// Run the setup
setupStorageBucket()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Setup failed:', error)
    process.exit(1)
  })
