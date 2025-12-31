/**
 * API Route: Submit General Service Request
 * POST /api/suppliers/service-request
 */

import { createServerSupabaseClient } from '@/lib/db/supabase'
import { getUser } from '@/lib/db/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // Get user (required for this endpoint)
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const { contactName, contactEmail, message, serviceNeeded } = await request.json()

    // Validate required fields
    if (!contactName || !contactEmail || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create service request (stored in same table with supplier_slug as 'general')
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('supplier_leads')
      .insert({
        supplier_slug: 'general-service-request',
        user_id: user.id,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: null,
        message,
        service_needed: serviceNeeded || 'Service Required',
        preferred_contact_method: 'email',
        source: 'directory_contact_us',
        status: 'new',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating service request:', error)
      return NextResponse.json({ error: 'Failed to submit service request' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error in service request route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
