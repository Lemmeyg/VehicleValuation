/**
 * API: Upload Directory Suppliers
 *
 * Handles file uploads for directory supplier markdown files
 * Stores files in Supabase Storage and metadata in database
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/db/admin-auth'
import { supabaseAdmin } from '@/lib/db/supabase'
import matter from 'gray-matter'

const serviceTypeDirectories: Record<string, string> = {
  appraiser: 'appraisers',
  body_shop: 'body-shops',
  advocate: 'advocates',
  attorney: 'attorneys',
}

export async function POST(request: NextRequest) {
  try {
    // Check admin access
    await requireAdmin()

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 })
    }

    console.log('[DIRECTORY_UPLOAD_START]', {
      totalFiles: files.length,
      fileNames: files.map(f => f.name),
    })

    const results = []
    const errors = []

    for (const file of files) {
      console.log('[PROCESSING_FILE]', file.name)
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
        const requiredFields = ['businessName', 'slug', 'serviceType', 'city', 'state', 'email']
        const missingFields = requiredFields.filter(field => !data[field])

        if (missingFields.length > 0) {
          console.log('[VALIDATION_ERROR]', {
            file: file.name,
            missingFields,
          })
          errors.push(`${file.name}: Missing required fields: ${missingFields.join(', ')}`)
          continue
        }

        console.log('[FRONTMATTER_PARSED]', {
          file: file.name,
          slug: data.slug,
          businessName: data.businessName,
          serviceType: data.serviceType,
        })

        // Validate service type
        if (!serviceTypeDirectories[data.serviceType]) {
          errors.push(
            `${file.name}: Invalid serviceType. Must be one of: ${Object.keys(serviceTypeDirectories).join(', ')}`
          )
          continue
        }

        // Generate storage path
        const serviceDir = serviceTypeDirectories[data.serviceType]
        const filename = data.slug.endsWith('.md') ? data.slug : `${data.slug}.md`
        const storagePath = `suppliers/${serviceDir}/${filename}`

        // Upload file to Supabase Storage using admin client
        const { error: uploadError } = await supabaseAdmin.storage
          .from('supplier-content')
          .upload(storagePath, content, {
            contentType: 'text/markdown',
            upsert: true, // Allow overwriting existing files
          })

        if (uploadError) {
          console.log('[STORAGE_ERROR]', {
            file: file.name,
            path: storagePath,
            error: uploadError.message,
          })
          errors.push(`${file.name}: Storage upload failed - ${uploadError.message}`)
          continue
        }

        console.log('[STORAGE_SUCCESS]', {
          file: file.name,
          path: storagePath,
        })

        // Insert or update supplier in database
        const supplierData = {
          slug: data.slug,
          business_name: data.businessName,
          contact_name: data.contactName || null,
          contact_email: data.email,
          contact_phone: data.phone || null,
          website_url: data.websiteUrl || null,
          service_type: data.serviceType,
          city: data.city,
          state: data.state,
          zip_code: data.zipCode || null,
          value_proposition: data.valueProposition || null,
          years_in_business: data.yearsInBusiness || null,
          specialties: data.specialties || [],
          certifications: data.certifications || [],
          insurance_accepted: data.insuranceAccepted || [],
          verified: data.verified || false,
          featured: data.featured || false,
          published: data.published !== false, // Default to true
          content: markdown,
          storage_path: storagePath,
        }

        const { error: dbError } = await supabaseAdmin.from('suppliers').upsert(supplierData)

        if (dbError) {
          console.log('[DB_ERROR]', {
            file: file.name,
            slug: data.slug,
            error: dbError.message,
          })
          errors.push(`${file.name}: Database insert failed - ${dbError.message}`)

          // Cleanup: Delete uploaded file if database insert fails
          await supabaseAdmin.storage.from('supplier-content').remove([storagePath])

          continue
        }

        console.log('[DB_SUCCESS]', {
          file: file.name,
          slug: data.slug,
          businessName: data.businessName,
        })

        results.push({
          filename: file.name,
          slug: data.slug,
          businessName: data.businessName,
          serviceType: data.serviceType,
          storagePath,
        })
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    // Return results
    console.log('[DIRECTORY_UPLOAD_SUMMARY]', {
      totalFiles: files.length,
      successful: results.length,
      failed: errors.length,
      errors: errors,
    })

    return NextResponse.json({
      success: results.length > 0,
      uploaded: results.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Directory upload error:', error)

    if (error instanceof Error && error.message.includes('Admin access required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
