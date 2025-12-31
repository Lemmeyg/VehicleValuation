/**
 * API Route: Add Supplier to Favorites
 * POST /api/suppliers/favorites/add
 */

import { createServerSupabaseClient } from '@/lib/db/supabase'
import { getUser } from '@/lib/db/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // Check authentication
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const { supplierSlug } = await request.json()

    if (!supplierSlug) {
      return NextResponse.json({ error: 'Supplier slug is required' }, { status: 400 })
    }

    // Add to favorites
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('user_saved_suppliers')
      .insert({
        user_id: user.id,
        supplier_slug: supplierSlug,
      })
      .select()
      .single()

    if (error) {
      // Check for duplicate error
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Supplier already in favorites' }, { status: 409 })
      }
      console.error('Error adding favorite:', error)
      return NextResponse.json({ error: 'Failed to add favorite' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error in add favorite route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
