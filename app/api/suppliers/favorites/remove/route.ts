/**
 * API Route: Remove Supplier from Favorites
 * DELETE /api/suppliers/favorites/remove
 */

import { createServerSupabaseClient } from '@/lib/db/supabase'
import { getUser } from '@/lib/db/auth'
import { NextResponse } from 'next/server'

export async function DELETE(request: Request) {
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

    // Remove from favorites
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('user_saved_suppliers')
      .delete()
      .eq('user_id', user.id)
      .eq('supplier_slug', supplierSlug)

    if (error) {
      console.error('Error removing favorite:', error)
      return NextResponse.json({ error: 'Failed to remove favorite' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in remove favorite route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
