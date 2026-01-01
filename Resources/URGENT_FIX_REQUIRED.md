# URGENT: Fix Supabase Anon Key

## Problem

Your `.env.local` file has the **WRONG KEY** for `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**Current value (WRONG):**
```
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_secret_ydNZDEDDgDjvr2d4vGu_Lw_HBli45ay
```

This starts with `sb_secret_` which means it's a **secret key**, NOT the public anonymous key.

**Error this causes:**
```
AuthApiError: Forbidden use of secret API key in browser
```

---

## Fix Required

### Step 1: Get the Correct Anon Key

1. **Go to:** https://app.supabase.com
2. **Select your project:** noijdbkcwcivewzwznru
3. **Go to:** Settings → API
4. **Find section:** "Project API keys"
5. **Look for:** `anon` `public` key (NOT `service_role`)
6. **Copy the key** - it should start with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS...`

### Step 2: Update .env.local

Replace the `NEXT_PUBLIC_SUPABASE_ANON_KEY` value in your `.env.local` file:

**Before (WRONG):**
```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_secret_ydNZDEDDgDjvr2d4vGu_Lw_HBli45ay
```

**After (CORRECT):**
```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS...
```

The correct key should:
- Be much longer (looks like a JWT token)
- Start with `eyJhbGciOiJIUzI1NiI...`
- NOT start with `sb_secret_`

### Step 3: Restart Dev Server

After updating `.env.local`:

```bash
# Stop the current dev server (Ctrl+C)
npm run dev
```

---

## Why This Matters

**Anon Key (Public):**
- ✅ Safe to use in browser
- ✅ Respects Row Level Security (RLS) policies
- ✅ Limited permissions
- ✅ Can be exposed in client-side code

**Service Role Key (Secret):**
- ❌ NEVER use in browser
- ❌ Bypasses ALL security policies
- ❌ Full admin access
- ❌ Must only be used server-side

---

## What You Currently Have

```env
# CORRECT (keep this)
NEXT_PUBLIC_SUPABASE_URL=https://noijdbkcwcivewzwznru.supabase.co

# WRONG - This is a secret key, not anon key
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_secret_ydNZDEDDgDjvr2d4vGu_Lw_HBli45ay

# CORRECT (keep this for server-side only)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## How to Find the Correct Key

In Supabase Dashboard under Settings → API, you should see:

```
Project API keys

┌─────────────────────────────────────────┐
│ anon public                             │
│ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... │  ← USE THIS ONE
│ [Copy]                                  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ service_role secret                     │
│ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... │  ← Don't use in browser
│ [Copy]                                  │
└─────────────────────────────────────────┘
```

---

## After Fixing

Once you update the anon key and restart the server:

1. The "Forbidden use of secret API key" error will go away
2. The magic link flow will work correctly
3. You can test the full authentication flow

---

**DO THIS NOW before testing again!**
