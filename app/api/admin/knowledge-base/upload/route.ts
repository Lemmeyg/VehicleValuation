/**
 * API: Upload Knowledge Base Articles
 *
 * Handles file uploads for knowledge base markdown files
 * Stores files in Supabase Storage and metadata in database
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/db/admin-auth'
import { supabaseAdmin } from '@/lib/db/supabase'
import matter from 'gray-matter'
import readingTime from 'reading-time'

export async function POST(request: NextRequest) {
  try {
    // Check admin access
    await requireAdmin()

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 })
    }

    // Use admin client for all operations (storage + database) to bypass RLS
    const results = []
    const errors = []

    for (const file of files) {
      try {
        // Validate file type
        if (!file.name.endsWith('.md')) {
          errors.push(`${file.name}: Invalid file type (must be .md)`)
          continue
        }

        // Read file content
        const content = await file.text()

        // Parse frontmatter
        const { data, content: markdown } = matter(content)

        // Validate required fields
        const requiredFields = ['title', 'slug', 'category', 'description', 'author']
        const missingFields = requiredFields.filter(field => !data[field])

        if (missingFields.length > 0) {
          errors.push(
            `${file.name}: Missing required fields: ${missingFields.join(', ')}`
          )
          continue
        }

        // Generate storage path
        const categorySlug = data.category
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')

        const filename = data.slug.endsWith('.md') ? data.slug : `${data.slug}.md`
        const storagePath = `knowledge-base/${categorySlug}/${filename}`

        // Upload file to Supabase Storage using admin client (bypasses RLS)
        const { error: uploadError } = await supabaseAdmin.storage
          .from('knowledge-base-content')
          .upload(storagePath, content, {
            contentType: 'text/markdown',
            upsert: true, // Allow overwriting existing files
          })

        if (uploadError) {
          console.error('[UPLOAD_ERROR] Storage upload failed:', {
            file: file.name,
            path: storagePath,
            error: uploadError
          })
          errors.push(`${file.name}: Storage upload failed - ${uploadError.message}`)
          continue
        }

        console.log('[UPLOAD_SUCCESS] File uploaded to storage:', {
          file: file.name,
          path: storagePath
        })

        // Calculate reading time
        const readingTimeText = readingTime(markdown).text

        // Insert or update article in database
        const articleData = {
          slug: data.slug,
          title: data.title,
          description: data.description,
          content: markdown,
          category: data.category,
          tags: data.tags || [],
          author: data.author,
          featured: data.featured || false,
          published: data.published !== false, // Default to true
          reading_time: readingTimeText,
          storage_path: storagePath,
          date_published: data.datePublished || data.date_published || new Date().toISOString(),
          date_modified: data.dateModified || data.date_modified || new Date().toISOString(),
        }

        // Upsert uses the UNIQUE constraint on 'slug' column (no onConflict parameter needed)
        // Use admin client to bypass RLS policies for reliable inserts
        const { error: dbError } = await supabaseAdmin
          .from('articles')
          .upsert(articleData)

        if (dbError) {
          console.error('[DB_ERROR] Database insert failed:', {
            file: file.name,
            slug: data.slug,
            error: dbError
          })
          errors.push(`${file.name}: Database insert failed - ${dbError.message}`)

          // Cleanup: Delete uploaded file if database insert fails
          console.log('[CLEANUP] Removing file from storage due to DB error:', storagePath)
          const { error: removeError } = await supabaseAdmin.storage
            .from('knowledge-base-content')
            .remove([storagePath])

          if (removeError) {
            console.error('[CLEANUP_ERROR] Failed to remove file:', removeError)
          }

          continue
        }

        console.log('[DB_SUCCESS] Article inserted/updated:', {
          file: file.name,
          slug: data.slug,
          title: data.title
        })

        results.push({
          filename: file.name,
          slug: data.slug,
          category: data.category,
          storagePath,
          title: data.title,
        })
      } catch (err) {
        errors.push(
          `${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`
        )
      }
    }

    // Log summary
    console.log('[UPLOAD_SUMMARY]', {
      totalFiles: files.length,
      successful: results.length,
      failed: errors.length,
      errors: errors
    })

    // Return results
    return NextResponse.json({
      success: results.length > 0, // Only true if at least one file succeeded
      uploaded: results.length,
      total: files.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Knowledge base upload error:', error)

    if (error instanceof Error && error.message.includes('Admin access required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
