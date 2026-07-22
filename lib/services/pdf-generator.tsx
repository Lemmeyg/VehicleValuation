/**
 * PDF Generation Service
 *
 * Service for generating PDF reports from vehicle data
 */

import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { VehicleReportPDF } from '@/lib/pdf/report-template'
import { supabaseAdmin } from '@/lib/db/supabase'
import { getPaidReportType } from '@/lib/utils/payment-tier'
import { addContactToList } from '@/lib/zoho-campaigns'

interface GeneratePDFOptions {
  reportId: string
}

interface ReportData {
  id: string
  vin: string
  user_id: string
  mileage?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  autodev_vin_data: any // Auto.dev VIN decode data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  marketcheck_valuation: any // MarketCheck price prediction and comparables
  price_paid: number
  status: string
  created_at: string
  email?: string | null
  vehicle_year?: number | null
  vehicle_make?: string | null
  vehicle_model?: string | null
  email_date_sent?: string | null
}

// 10-year TTL for admin-only signed URLs stored in the database.
// Never surfaced in API responses — DB access required to retrieve.
export const ADMIN_URL_TTL_SECONDS = 315_360_000 // 10 * 365 * 24 * 60 * 60

/**
 * Generate PDF report and upload to Supabase Storage
 */
export async function generateAndUploadPDF(
  options: GeneratePDFOptions
): Promise<{ success: boolean; error?: string; pdfUrl?: string }> {
  try {
    const { reportId } = options

    // Use admin client to bypass RLS - called from webhook context without user session
    const supabase = supabaseAdmin
    const { data: report, error: fetchError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (fetchError || !report) {
      console.error('Error fetching report:', fetchError)
      return { success: false, error: 'Report not found' }
    }

    const reportData = report as ReportData

    // price_paid is the real tax-inclusive charged total, not a stable per-tier
    // constant — payments.metadata.reportType (set at checkout) is authoritative.
    const reportType = (await getPaidReportType(supabase, reportId)) ?? 'BASIC'

    // Prepare data for PDF template
    const pdfData = {
      id: reportData.id,
      vin: reportData.vin,
      mileage: reportData.mileage,
      reportType,
      createdAt: reportData.created_at,
      autodevVinData: reportData.autodev_vin_data, // Auto.dev VIN decode data
      marketcheckValuation: reportData.marketcheck_valuation, // MarketCheck price prediction and comparables
    }

    // Generate PDF buffer
    const pdfBuffer = await renderToBuffer(<VehicleReportPDF data={pdfData} />)

    // Generate filename from vehicle year/make/model, falling back to VIN
    const vinData = reportData.autodev_vin_data
    const vehicleYear = vinData?.vehicle?.year
    const vehicleMake = vinData?.make
    const vehicleModel = vinData?.model

    let filenamePart: string
    if (vehicleYear && vehicleMake && vehicleModel) {
      filenamePart = `${vehicleYear}-${vehicleMake}-${vehicleModel}`
        .replace(/[^A-Za-z0-9-]/g, '-')
        .replace(/-+/g, '-')
    } else {
      filenamePart = reportData.vin.toUpperCase().replace(/[^A-Z0-9]/g, '')
    }
    const filename = `total-loss-report-${filenamePart}.pdf`
    const filepath = `reports/${reportData.user_id}/${filename}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('vehicle-reports')
      .upload(filepath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError)
      return { success: false, error: 'Failed to upload PDF' }
    }

    // Generate a 1-hour signed URL for the immediate response
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('vehicle-reports')
      .createSignedUrl(filepath, 3600)

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Error creating signed URL:', signedUrlError)
      return { success: false, error: 'Failed to create signed URL' }
    }

    // Generate a long-lived admin URL (10 years) stored only in the DB.
    // Never returned by any API route — accessible to DB admins only.
    const { data: adminUrlData } = await supabase.storage
      .from('vehicle-reports')
      .createSignedUrl(filepath, ADMIN_URL_TTL_SECONDS)

    // Update report: store the storage path (permanent) and mark completed
    const { error: updateError } = await supabase
      .from('reports')
      .update({
        pdf_url: signedUrlData.signedUrl,
        pdf_storage_path: filepath,
        pdf_admin_url: adminUrlData?.signedUrl ?? null,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)

    if (updateError) {
      console.error('Error updating report:', updateError)
      return { success: false, error: 'Failed to update report' }
    }

    // Enroll the customer in the Zoho Campaigns "Report Delivery" list so its
    // Workflow Automation sends the download-link email. Awaited (not
    // fire-and-forget) so email_date_sent can be gated on actual success —
    // an unconditional set would permanently disable the send if this first
    // attempt hit a transient Zoho failure. Wrapped in its own try/catch so
    // nothing here can mark this otherwise-successful generation as failed.
    if (reportData.price_paid && !reportData.email_date_sent && reportData.email) {
      const listKey = process.env.ZOHO_CAMPAIGNS_REPORT_DELIVERY_LIST_KEY
      if (listKey) {
        try {
          const enrolled = await addContactToList({
            listKey,
            email: reportData.email,
            customFields: {
              Year: reportData.vehicle_year?.toString() ?? '',
              Make: reportData.vehicle_make ?? '',
              Model: reportData.vehicle_model ?? '',
              ReportUrl: adminUrlData?.signedUrl ?? '',
            },
          })
          if (enrolled) {
            const { error: flagUpdateError } = await supabase
              .from('reports')
              .update({ email_date_sent: new Date().toISOString() })
              .eq('id', reportId)
            if (flagUpdateError) {
              console.error(
                '[pdf-generator] Failed to write email_date_sent after Zoho enrollment:',
                flagUpdateError
              )
            }
          }
        } catch (err) {
          console.error('[pdf-generator] Zoho report-delivery enrollment error:', err)
        }
      }
    }

    return {
      success: true,
      pdfUrl: signedUrlData.signedUrl,
    }
  } catch (error) {
    console.error('Error generating PDF:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Generate PDF buffer without uploading (for testing or email attachments)
 */
export async function generatePDFBuffer(reportId: string): Promise<Buffer | null> {
  try {
    const supabase = supabaseAdmin
    const { data: report, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (error || !report) {
      console.error('Error fetching report:', error)
      return null
    }

    const reportData = report as ReportData
    const reportType = (await getPaidReportType(supabase, reportId)) ?? 'BASIC'

    const pdfData = {
      id: reportData.id,
      vin: reportData.vin,
      mileage: reportData.mileage,
      reportType,
      createdAt: reportData.created_at,
      autodevVinData: reportData.autodev_vin_data, // Auto.dev VIN decode data
      marketcheckValuation: reportData.marketcheck_valuation, // MarketCheck price prediction and comparables
    }

    const pdfBuffer = await renderToBuffer(<VehicleReportPDF data={pdfData} />)
    return Buffer.from(pdfBuffer)
  } catch (error) {
    console.error('Error generating PDF buffer:', error)
    return null
  }
}
