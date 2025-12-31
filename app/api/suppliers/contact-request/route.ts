/**
 * API Route: Submit Contact Request to Supplier
 * POST /api/suppliers/contact-request
 */

import { createServerSupabaseClient } from '@/lib/db/supabase'
import { getUser } from '@/lib/db/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // Get user (optional - can be anonymous)
    const user = await getUser()

    // Parse request body
    const {
      supplierSlug,
      contactName,
      contactEmail,
      contactPhone,
      message,
      preferredContactMethod,
      serviceNeeded,
    } = await request.json()

    // Validate required fields
    if (!supplierSlug || !contactName || !contactEmail || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create contact request (lead)
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('supplier_leads')
      .insert({
        supplier_slug: supplierSlug,
        user_id: user?.id || null,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone || null,
        message,
        service_needed: serviceNeeded || 'Contact Request',
        preferred_contact_method: preferredContactMethod || 'email',
        source: 'directory_page',
        status: 'new',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating contact request:', error)
      return NextResponse.json({ error: 'Failed to submit contact request' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error in contact request route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
