/**
 * API Route: GET /api/suppliers
 *
 * Fetches suppliers from database with optional filters
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAllSuppliers } from '@/lib/suppliers-db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const featured = searchParams.get('featured') === 'true'
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
    const state = searchParams.get('state') || undefined
    const serviceType = searchParams.get('serviceType') as any || undefined

    // Fetch suppliers with filters
    let suppliers = await getAllSuppliers({
      state,
      serviceType,
      featured: featured ? true : undefined,
    })

    // Apply limit if specified
    if (limit) {
      suppliers = suppliers.slice(0, limit)
    }

    return NextResponse.json({
      success: true,
      suppliers,
      count: suppliers.length,
    })
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch suppliers',
      },
      { status: 500 }
    )
  }
}
