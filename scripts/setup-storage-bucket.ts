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

const BUCKET_NAME = 'knowledge-base-content'

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
    // Check if bucket exists
    console.log(`🔍 Checking if bucket '${BUCKET_NAME}' exists...`)
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      console.error('❌ Error listing buckets:', listError.message)
      process.exit(1)
    }

    const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME)

    if (bucketExists) {
      console.log(`✅ Bucket '${BUCKET_NAME}' already exists\n`)

      // Get bucket details
      const bucket = buckets?.find(b => b.name === BUCKET_NAME)
      console.log('📋 Bucket details:')
      console.log(`   - Name: ${bucket?.name}`)
      console.log(`   - ID: ${bucket?.id}`)
      console.log(`   - Public: ${bucket?.public}`)
      console.log(`   - Created: ${bucket?.created_at}\n`)

      if (!bucket?.public) {
        console.log('⚠️  WARNING: Bucket is not public!')
        console.log('   Uploaded files may not be accessible.')
        console.log('   To make it public, run:')
        console.log(`   - Go to Supabase Dashboard > Storage > ${BUCKET_NAME}`)
        console.log('   - Click Settings > Make bucket public\n')
      }
    } else {
      console.log(`📦 Creating bucket '${BUCKET_NAME}'...`)

      const { data: newBucket, error: createError } = await supabase.storage.createBucket(
        BUCKET_NAME,
        {
          public: true,
          fileSizeLimit: 5242880, // 5MB in bytes
          allowedMimeTypes: ['text/markdown', 'text/plain']
        }
      )

      if (createError) {
        console.error('❌ Error creating bucket:', createError.message)
        process.exit(1)
      }

      console.log(`✅ Bucket '${BUCKET_NAME}' created successfully!\n`)
      console.log('📋 Bucket details:')
      console.log(`   - Name: ${BUCKET_NAME}`)
      console.log(`   - Public: true`)
      console.log(`   - Max file size: 5MB`)
      console.log(`   - Allowed types: text/markdown, text/plain\n`)
    }

    // Test upload/download
    console.log('🧪 Testing bucket access...')
    const testContent = '# Test File\n\nThis is a test upload.'
    const testPath = 'test/test-file.md'

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(testPath, testContent, {
        contentType: 'text/markdown',
        upsert: true
      })

    if (uploadError) {
      console.error('❌ Error uploading test file:', uploadError.message)
      console.error('\n💡 This might be a permissions issue.')
      console.error('   Check RLS policies in Supabase Dashboard > Storage > Policies\n')
      process.exit(1)
    }

    console.log('✅ Test file uploaded successfully')

    // Clean up test file
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([testPath])

    if (deleteError) {
      console.warn('⚠️  Warning: Could not delete test file:', deleteError.message)
    } else {
      console.log('✅ Test file cleaned up\n')
    }

    console.log('🎉 Storage bucket setup complete!\n')
    console.log('Next steps:')
    console.log('1. Upload markdown files via the admin panel at /admin/knowledge-base/upload')
    console.log('2. Files will be stored in the bucket under knowledge-base/{category}/{slug}.md')
    console.log('3. Article metadata will be saved in the articles table\n')

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
