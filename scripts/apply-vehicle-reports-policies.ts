/**
 * Apply Vehicle Reports Storage Policies
 *
 * This script applies RLS policies for the vehicle-reports bucket
 * Run with: npx tsx scripts/apply-vehicle-reports-policies.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function applyPolicies() {
  console.log('🚀 Applying vehicle-reports storage policies...\n')

  // Verify environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables')
    process.exit(1)
  }

  // Create Supabase client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  console.log('✅ Connected to Supabase\n')

  const policies = [
    {
      name: 'Users can upload their own vehicle reports',
      sql: `
        CREATE POLICY "Users can upload their own vehicle reports"
          ON storage.objects FOR INSERT
          TO authenticated
          WITH CHECK (
            bucket_id = 'vehicle-reports'
            AND (storage.foldername(name))[1] = 'reports'
            AND (storage.foldername(name))[2] = auth.uid()::text
          );
      `,
    },
    {
      name: 'Anyone can read vehicle reports',
      sql: `
        CREATE POLICY "Anyone can read vehicle reports"
          ON storage.objects FOR SELECT
          TO public
          USING (bucket_id = 'vehicle-reports');
      `,
    },
    {
      name: 'Users can update their own vehicle reports',
      sql: `
        CREATE POLICY "Users can update their own vehicle reports"
          ON storage.objects FOR UPDATE
          TO authenticated
          USING (
            bucket_id = 'vehicle-reports'
            AND (storage.foldername(name))[1] = 'reports'
            AND (storage.foldername(name))[2] = auth.uid()::text
          );
      `,
    },
    {
      name: 'Users can delete their own vehicle reports',
      sql: `
        CREATE POLICY "Users can delete their own vehicle reports"
          ON storage.objects FOR DELETE
          TO authenticated
          USING (
            bucket_id = 'vehicle-reports'
            AND (storage.foldername(name))[1] = 'reports'
            AND (storage.foldername(name))[2] = auth.uid()::text
          );
      `,
    },
  ]

  try {
    for (const policy of policies) {
      console.log(`📝 Creating policy: ${policy.name}`)

      const { error } = await supabase.rpc('exec_sql', {
        sql: policy.sql,
      })

      if (error) {
        // Check if error is because policy already exists
        if (error.message?.includes('already exists')) {
          console.log(`   ℹ️  Policy already exists, skipping...`)
        } else {
          console.error(`   ❌ Error: ${error.message}`)
        }
      } else {
        console.log(`   ✅ Created successfully`)
      }
    }

    console.log('\n🎉 Policy setup complete!\n')
    console.log('You can now generate and download PDF reports.')
    console.log('Try it: Navigate to any report and click "Download PDF"\n')
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    console.error('\n💡 Manual setup required:')
    console.error('1. Go to Supabase Dashboard: https://supabase.com/dashboard')
    console.error('2. Navigate to Storage > vehicle-reports > Policies')
    console.error('3. Copy the SQL from: supabase/migrations/20260111000000_create_vehicle_reports_bucket.sql')
    console.error('4. Or go to SQL Editor and run the migration file\n')
    process.exit(1)
  }
}

// Run the script
applyPolicies()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
