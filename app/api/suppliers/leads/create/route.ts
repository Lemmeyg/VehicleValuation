/**
 * Lead Submission API Route
 *
 * Handles POST requests to create new supplier lead inquiries
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/db/supabase'
import { getUser } from '@/lib/db/auth'

// Validation schema
const LeadSchema = z.object({
  supplierSlug: z.string().min(1, 'Supplier slug is required'),
  contactName: z.string().min(2, 'Name must be at least 2 characters'),
  contactEmail: z.string().email('Invalid email address'),
  contactPhone: z.string().optional(),
  serviceNeeded: z.string().min(1, 'Service type is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  preferredContactMethod: z.enum(['email', 'phone']),
})

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()

    // Validate with Zod
    const validationResult = LeadSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      )
    }

    const leadData = validationResult.data

    // Get Supabase client and current user (if authenticated)
    const supabase = await createServerSupabaseClient()
    const user = await getUser()

    // Insert lead into database
    const { data, error } = await supabase
      .from('supplier_leads')
      .insert({
        supplier_slug: leadData.supplierSlug,
        user_id: user?.id || null, // null if not logged in
        contact_name: leadData.contactName,
        contact_email: leadData.contactEmail,
        contact_phone: leadData.contactPhone || null,
        message: leadData.message,
        service_needed: leadData.serviceNeeded,
        preferred_contact_method: leadData.preferredContactMethod,
        status: 'new',
        source: 'directory_page',
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        { error: 'Failed to submit lead. Please try again.' },
        { status: 500 }
      )
    }

    // TODO: Send email notification to supplier (future enhancement)
    // TODO: Send confirmation email to user (future enhancement)

    return NextResponse.json(
      {
        success: true,
        message: 'Lead submitted successfully',
        leadId: data.id,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Lead submission error:', error)

    return NextResponse.json(
      {
        error: 'An unexpected error occurred. Please try again.',
      },
      { status: 500 }
    )
  }
}

// OPTIONS handler for CORS (if needed)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
