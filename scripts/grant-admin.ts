/**
 * Grant Admin Access Script
 *
 * This script grants admin access to a user by adding them to the admins table.
 *
 * Run with: npx tsx scripts/grant-admin.ts <email>
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables!')
  console.error('   Make sure .env.local is loaded')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function grantAdminAccess(email: string) {
  console.log(`\n🔐 Granting admin access to: ${email}\n`)

  // 1. Find user by email
  console.log('1️⃣  Finding user...')
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers()

  if (userError) {
    console.error('❌ Error listing users:', userError.message)
    process.exit(1)
  }

  const user = userData.users.find(u => u.email === email)

  if (!user) {
    console.error(`❌ User not found: ${email}`)
    console.error('\n💡 Make sure the user has signed up in your app first')
    process.exit(1)
  }

  console.log(`✅ Found user: ${user.email} (${user.id})`)

  // 2. Check if already admin
  console.log('\n2️⃣  Checking current admin status...')
  const { data: existingAdmin } = await supabaseAdmin
    .from('admins')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingAdmin) {
    console.log('⚠️  User is already an admin!')
    console.log(`   Granted: ${new Date(existingAdmin.granted_at).toLocaleString()}`)
    return
  }

  // 3. Grant admin access
  console.log('\n3️⃣  Granting admin access...')
  const { error: insertError } = await supabaseAdmin.from('admins').insert({
    user_id: user.id,
    notes: `Admin access granted via script on ${new Date().toISOString()}`,
  })

  if (insertError) {
    console.error('❌ Error granting admin access:', insertError.message)
    process.exit(1)
  }

  console.log('✅ Admin access granted successfully!')

  // 4. Verify
  console.log('\n4️⃣  Verifying...')
  const { data: verifyAdmin } = await supabaseAdmin
    .from('admins')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (verifyAdmin) {
    console.log('✅ Verification successful!')
    console.log('\n🎉 Done! The user can now access /admin')
    console.log('\n💡 Next steps:')
    console.log('   1. Log in as', email)
    console.log('   2. Navigate to /admin')
    console.log('   3. You should now have access!')
  } else {
    console.error('❌ Verification failed - admin record not found')
    process.exit(1)
  }
}

// Get email from command line
const email = process.argv[2]

if (!email) {
  console.error('❌ Email required!')
  console.error('\nUsage: npx tsx scripts/grant-admin.ts <email>')
  console.error('Example: npx tsx scripts/grant-admin.ts loladev2026@gmail.com')
  process.exit(1)
}

grantAdminAccess(email).catch(err => {
  console.error('\n❌ Error:', err.message)
  process.exit(1)
})
