/**
 * Admin Status Diagnostic Script
 *
 * This script helps debug admin access issues by checking:
 * 1. If the admins table exists
 * 2. If your user is in the admins table
 * 3. Current authentication status
 *
 * Run with: npx tsx scripts/check-admin-status.ts <your-email@example.com>
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables!')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? '✓' : '✗')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function checkAdminStatus(email?: string) {
  console.log('\n🔍 Admin Status Diagnostic Tool\n')
  console.log('=' .repeat(60))

  // 1. Check if admins table exists
  console.log('\n1️⃣  Checking if admins table exists...')
  const { data: tables, error: tablesError } = await supabaseAdmin
    .from('admins')
    .select('*')
    .limit(1)

  if (tablesError) {
    console.error('❌ Error accessing admins table:', tablesError.message)
    console.error('\n💡 Solution: Run the migration:')
    console.error('   supabase db push supabase/migrations/20260101000000_secure_admin_roles.sql')
    return
  }

  console.log('✅ Admins table exists!')

  // 2. List all admins
  console.log('\n2️⃣  Listing all admin users...')
  const { data: allAdmins, error: adminsError } = await supabaseAdmin
    .from('admins')
    .select('user_id, granted_at, notes')

  if (adminsError) {
    console.error('❌ Error fetching admins:', adminsError.message)
    return
  }

  if (!allAdmins || allAdmins.length === 0) {
    console.log('⚠️  No admin users found in the database!')
    console.log('\n💡 Solution: Add an admin user (see step 4 below)')
  } else {
    console.log(`✅ Found ${allAdmins.length} admin(s):`)

    // Get user details for each admin
    for (const admin of allAdmins) {
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(admin.user_id)
      console.log(`   - ${user?.user?.email || admin.user_id}`)
      console.log(`     User ID: ${admin.user_id}`)
      console.log(`     Granted: ${new Date(admin.granted_at).toLocaleString()}`)
      if (admin.notes) console.log(`     Notes: ${admin.notes}`)
    }
  }

  // 3. Check specific user (if email provided)
  if (email) {
    console.log(`\n3️⃣  Checking admin status for: ${email}`)

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers()

    if (userError) {
      console.error('❌ Error listing users:', userError.message)
      return
    }

    const user = userData.users.find(u => u.email === email)

    if (!user) {
      console.log(`❌ User not found: ${email}`)
      console.log('\n💡 Make sure you are logged in with this email in the staging environment')
      return
    }

    console.log(`✅ User found: ${user.email}`)
    console.log(`   User ID: ${user.id}`)
    console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`)

    // Check if user is admin
    const { data: adminRecord, error: adminCheckError } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (adminCheckError) {
      console.error('❌ Error checking admin status:', adminCheckError.message)
      return
    }

    if (adminRecord) {
      console.log('✅ This user IS an admin!')
      console.log(`   Granted: ${new Date(adminRecord.granted_at).toLocaleString()}`)
    } else {
      console.log('❌ This user is NOT an admin')
      console.log('\n💡 Solution: Grant admin access (see step 4 below)')
    }
  }

  // 4. Instructions for granting admin access
  console.log('\n4️⃣  How to grant admin access:')
  console.log('=' .repeat(60))
  console.log('\nOption A: Using Supabase Dashboard SQL Editor')
  console.log('   1. Go to: https://supabase.com/dashboard/project/noijdbkcwcivewzwznru/sql/new')
  console.log('   2. Run this SQL (replace email):')
  console.log(`
   INSERT INTO public.admins (user_id, notes)
   SELECT id, 'Admin access granted manually'
   FROM auth.users
   WHERE email = 'your-email@example.com'
   ON CONFLICT (user_id) DO NOTHING;
  `)

  console.log('\nOption B: Using this script')
  console.log('   Run: npm run grant-admin <email>')

  console.log('\n' + '=' .repeat(60))
  console.log('✨ Diagnostic complete!\n')
}

// Get email from command line argument
const email = process.argv[2]

if (!email) {
  console.log('Usage: npx tsx scripts/check-admin-status.ts <your-email@example.com>')
  console.log('\nRunning general diagnostics...')
}

checkAdminStatus(email).catch(console.error)
