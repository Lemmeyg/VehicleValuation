/**
 * POST /api/admin/reports/[id]/regenerate-pdf
 *
 * Admin-only endpoint to regenerate the PDF for an existing report.
 * Useful for reports stuck in 'pending' state where data is present
 * but PDF generation failed (e.g. Vercel Lambda killed mid-flight).
 */

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/db/admin-auth'
import { generateAndUploadPDF } from '@/lib/services/pdf-generator'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    await requireAdmin()

    const { id: reportId } = await params

    const result = await generateAndUploadPDF({ reportId })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, pdfUrl: result.pdfUrl })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
