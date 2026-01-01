/**
 * Generate PDF API Route
 *
 * Endpoint to generate and upload PDF report
 */

import { NextResponse } from 'next/server'
import { getUser } from '@/lib/db/auth'
import { createServerSupabaseClient } from '@/lib/db/supabase'
import { generateAndUploadPDF } from '@/lib/services/pdf-generator'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    // Verify user is authenticated
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: reportId } = await params

    // Verify user owns this report
    const supabase = await createServerSupabaseClient()
    const { data: report, error: fetchError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Check if report has been paid for
    if (!report.price_paid || report.price_paid === 0) {
      return NextResponse.json(
        { error: 'Report has not been paid for' },
        { status: 400 }
      )
    }

    // Check if PDF already exists
    if (report.pdf_url) {
      return NextResponse.json(
        {
          message: 'PDF already generated',
          pdfUrl: report.pdf_url,
        },
        { status: 200 }
      )
    }

    // Generate and upload PDF
    const result = await generateAndUploadPDF({ reportId })

    if (!result.success) {
      console.error('PDF generation failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Failed to generate PDF' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'PDF generated successfully',
      pdfUrl: result.pdfUrl,
    })
  } catch (error) {
    console.error('Error in generate-pdf route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to check PDF generation status
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: reportId } = await params

    const supabase = await createServerSupabaseClient()
    const { data: report, error } = await supabase
      .from('reports')
      .select('pdf_url, status')
      .eq('id', reportId)
      .eq('user_id', user.id)
      .single()

    if (error || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    return NextResponse.json({
      pdfUrl: report.pdf_url,
      status: report.status,
      isReady: !!report.pdf_url && report.status === 'completed',
    })
  } catch (error) {
    console.error('Error checking PDF status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
