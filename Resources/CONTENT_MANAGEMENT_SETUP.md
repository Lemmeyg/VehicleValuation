# Content Management System Setup Guide

This guide explains how to set up the database-driven Content Management System for Knowledge Base articles and Directory suppliers that works with Netlify deployment.

## Overview

The system uses:
- **Supabase Database** - Stores article/supplier metadata and content
- **Supabase Storage** - Stores markdown files (optional backup)
- **Admin Portal** - Upload interface for managing content

This approach works perfectly with Netlify because content is stored in the database, not the filesystem.

---

## Step 1: Run Database Migration

### 1.1 Access Supabase SQL Editor

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `noijdbkcwcivewzwznru`
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### 1.2 Run the Migration

1. Open the file: `supabase/migrations/20241221000000_create_content_management.sql`
2. Copy the ENTIRE contents
3. Paste into the SQL Editor
4. Click **Run** (bottom right)
5. Wait for "Success" message

**What this creates:**
- `articles` table for Knowledge Base content
- Enhanced `suppliers` table with content fields
- Full-text search functions
- Storage bucket RLS policies
- Helper functions for querying

---

## Step 2: Create Storage Buckets

### 2.1 Create Knowledge Base Bucket

1. In Supabase Dashboard, click **Storage** in left sidebar
2. Click **New bucket**
3. Configure:
   - **Name**: `knowledge-base-content`
   - **Public bucket**: ✅ Yes (check the box)
   - **File size limit**: 5 MB
   - **Allowed MIME types**: Leave default (or add: `text/markdown`, `text/plain`)
4. Click **Create bucket**

### 2.2 Create Supplier Content Bucket

1. Click **New bucket** again
2. Configure:
   - **Name**: `supplier-content`
   - **Public bucket**: ✅ Yes (check the box)
   - **File size limit**: 5 MB
   - **Allowed MIME types**: Leave default
3. Click **Create bucket**

### 2.3 Verify Buckets

Run this query in SQL Editor:
```sql
SELECT name, public FROM storage.buckets
WHERE name IN ('knowledge-base-content', 'supplier-content');
```

Expected result: Both buckets should show `public = true`

---

## Step 3: Verify Storage RLS Policies

The migration already created the storage policies. **Note:** The Supabase UI may show "No policies created yet" under each bucket, but the policies exist at the database level.

### Verify Policies Exist

Run this query in SQL Editor:
```sql
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (policyname ILIKE '%knowledge%' OR policyname ILIKE '%supplier%')
ORDER BY policyname;
```

**Expected result:** You should see 8 policies listed.

If you get an error saying policies already exist, that's **good** - it means they're already set up!

### If Policies Are Missing

If the query above returns 0 rows, run this SQL:

```sql
-- Knowledge Base Storage Policies
CREATE POLICY "Anyone can read knowledge base files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'knowledge-base-content');

CREATE POLICY "Service role can upload knowledge base files"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'knowledge-base-content');

CREATE POLICY "Service role can update knowledge base files"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'knowledge-base-content');

CREATE POLICY "Service role can delete knowledge base files"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'knowledge-base-content');

-- Supplier Content Storage Policies
CREATE POLICY "Anyone can read supplier files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'supplier-content');

CREATE POLICY "Service role can upload supplier files"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'supplier-content');

CREATE POLICY "Service role can update supplier files"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'supplier-content');

CREATE POLICY "Service role can delete supplier files"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'supplier-content');
```

---

## Step 4: Update Application Code (Optional)

### Option A: Use Database-Only (Recommended for Production)

The new library files (`lib/knowledge-base-db.ts` and `lib/suppliers-db.ts`) are ready to use.

**To switch to database mode:**

1. Update imports in your pages:
   ```typescript
   // Before:
   import { getAllArticles, getArticleBySlug } from '@/lib/knowledge-base'

   // After:
   import { getAllArticles, getArticleBySlug } from '@/lib/knowledge-base-db'
   ```

2. Do the same for suppliers:
   ```typescript
   // Before:
   import { getAllSuppliers, getSupplierBySlug } from '@/lib/suppliers'

   // After:
   import { getAllSuppliers, getSupplierBySlug } from '@/lib/suppliers-db'
   ```

### Option B: Keep File-Based for Local Dev

Keep using the current file-based libraries (`lib/knowledge-base.ts` and `lib/suppliers.ts`) for local development. They will continue working with the markdown files in the `content/` directory.

**This allows:**
- Local dev uses markdown files (fast, no database calls)
- Production uses database (works on Netlify)

---

## Step 5: Migrate Existing Content to Database

You have two options to populate the database with existing content:

### Option 1: Use Admin Upload Feature (Recommended)

1. Ensure you have admin access (see `FIX_ADMIN_ACCESS.md`)
2. Go to http://localhost:3000/admin/knowledge-base
3. Click **Upload Files**
4. Select your markdown files from `content/knowledge-base/`
5. Click **Upload**
6. Repeat for Directory: http://localhost:3000/admin/directory

### Option 2: Bulk Import Script

Create a Node.js script to bulk import:

```javascript
// scripts/migrate-content.js
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
const matter = require('gray-matter')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function migrateArticles() {
  const articlesDir = path.join(__dirname, '../content/knowledge-base')
  const categories = fs.readdirSync(articlesDir)

  for (const category of categories) {
    const categoryPath = path.join(articlesDir, category)
    if (!fs.statSync(categoryPath).isDirectory()) continue

    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.md'))

    for (const file of files) {
      const filePath = path.join(categoryPath, file)
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      const { data, content } = matter(fileContent)

      const { error } = await supabase.from('articles').upsert({
        slug: data.slug,
        title: data.title,
        description: data.description,
        content: content,
        category: data.category,
        tags: data.tags || [],
        author: data.author,
        featured: data.featured || false,
        published: data.published !== false,
        reading_time: data.readingTime || '5 min read',
        date_published: data.datePublished,
        date_modified: data.dateModified,
      })

      if (error) console.error(`Error importing ${file}:`, error)
      else console.log(`✓ Imported ${file}`)
    }
  }
}

migrateArticles()
```

Run with: `node scripts/migrate-content.js`

---

## Step 6: Test the System

### 6.1 Test Article Upload

1. Go to http://localhost:3000/admin/knowledge-base
2. Click **Upload Files**
3. Create a test markdown file:

```markdown
---
title: 'Test Article'
description: 'This is a test article'
category: 'test'
tags: ['test']
author: 'Admin'
datePublished: '2024-12-21'
dateModified: '2024-12-21'
featured: false
published: true
slug: 'test-article'
---

# Test Article

This is test content.
```

4. Upload the file
5. Verify in database:
   ```sql
   SELECT * FROM articles WHERE slug = 'test-article';
   ```

### 6.2 Test Supplier Upload

1. Go to http://localhost:3000/admin/directory
2. Click **Upload Files**
3. Create a test supplier file:

```markdown
---
businessName: 'Test Appraiser'
contactName: 'John Doe'
email: 'test@example.com'
phone: '555-1234'
city: 'Chicago'
state: 'IL'
serviceType: 'appraiser'
specialties:
  - 'total_loss'
valueProposition: 'Test services'
verified: true
featured: false
published: true
slug: 'test-appraiser'
---

# About Test Appraiser

Test content.
```

4. Upload the file
5. Verify in database:
   ```sql
   SELECT * FROM suppliers WHERE slug = 'test-appraiser';
   ```

---

## Step 7: Deploy to Netlify

Once everything works locally:

### 7.1 Ensure Environment Variables are Set in Netlify

Go to Netlify Dashboard → Site Settings → Environment Variables and verify:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### 7.2 Update Code to Use Database Libraries

Make sure your production code imports from the `-db` versions:
- `lib/knowledge-base-db.ts`
- `lib/suppliers-db.ts`

### 7.3 Deploy

Push to GitHub and Netlify will auto-deploy. Content updates will now be instant!

---

## Troubleshooting

### "Table does not exist" Error

**Solution:** Run the migration again in Supabase SQL Editor

### "Storage bucket not found" Error

**Solution:** Create the buckets manually in Supabase Dashboard (see Step 2)

### "Permission denied for storage" Error

**Solution:** Verify RLS policies are created (see Step 3)

### Uploads Fail with "Unauthorized"

**Solution:** Check that `SUPABASE_SERVICE_ROLE_KEY` is set correctly in `.env.local`

### Content Not Showing on Site

**Solution:**
1. Verify data is in database: `SELECT * FROM articles;`
2. Check that code is using `-db` library versions
3. Clear Next.js cache: `rm -rf .next && npm run dev`

---

## Database Schema Reference

### Articles Table
```sql
CREATE TABLE articles (
  id UUID PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  tags TEXT[],
  author VARCHAR(255) NOT NULL,
  featured BOOLEAN DEFAULT false,
  published BOOLEAN DEFAULT true,
  reading_time VARCHAR(50),
  storage_path TEXT,
  date_published TIMESTAMPTZ NOT NULL,
  date_modified TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Suppliers Table (Enhanced)
```sql
ALTER TABLE suppliers
  ADD COLUMN content TEXT,
  ADD COLUMN storage_path TEXT,
  ADD COLUMN city VARCHAR(100),
  ADD COLUMN contact_name VARCHAR(255),
  ADD COLUMN contact_email VARCHAR(255),
  ADD COLUMN contact_phone VARCHAR(20),
  ADD COLUMN website_url TEXT,
  ADD COLUMN zip_code VARCHAR(10),
  ADD COLUMN value_proposition TEXT,
  ADD COLUMN years_in_business INTEGER,
  ADD COLUMN specialties TEXT[],
  ADD COLUMN certifications TEXT[],
  ADD COLUMN insurance_accepted TEXT[];
```

---

## Benefits of This System

✅ **Works on Netlify** - No filesystem writes needed
✅ **Instant Updates** - Content changes appear immediately (no rebuild)
✅ **Searchable** - Full-text search built-in
✅ **Scalable** - Database handles thousands of articles/suppliers
✅ **Version Control** - Files stored in Supabase Storage as backup
✅ **Admin-Friendly** - Upload interface for non-technical users
✅ **SEO-Friendly** - Still generates static pages at build time

---

## Next Steps

1. ✅ Run migration
2. ✅ Create storage buckets
3. ✅ Upload existing content
4. ✅ Test locally
5. ✅ Update imports to use `-db` libraries
6. ✅ Deploy to Netlify
7. 🎉 Enjoy instant content updates!

---

**Questions?** Check the troubleshooting section or review the migration SQL file for details.
