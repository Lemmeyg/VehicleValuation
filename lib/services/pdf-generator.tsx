/**
 * PDF Generation Service
 *
 * Service for generating PDF reports from vehicle data
 */

import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { VehicleReportPDF } from '@/lib/pdf/report-template'
import { createServerSupabaseClient } from '@/lib/db/supabase'

interface GeneratePDFOptions {
  reportId: string
}

interface ReportData {
  id: string
  vin: string
  user_id: string
  autodev_vin_data: any // Auto.dev VIN decode data
  marketcheck_valuation: any // MarketCheck price prediction and comparables
  price_paid: number
  status: string
  created_at: string
}

/**
 * Generate PDF report and upload to Supabase Storage
 */
export async function generateAndUploadPDF(
  options: GeneratePDFOptions
): Promise<{ success: boolean; error?: string; pdfUrl?: string }> {
  try {
    const { reportId } = options

    // Fetch report data from database
    const supabase = await createServerSupabaseClient()
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

    // Determine report type based on price_paid
    const reportType = reportData.price_paid === 2900 ? 'BASIC' : 'PREMIUM'

    // Prepare data for PDF template
    const pdfData = {
      vin: reportData.vin,
      reportType: reportType as 'BASIC' | 'PREMIUM',
      createdAt: reportData.created_at,
      autodevVinData: reportData.autodev_vin_data, // Auto.dev VIN decode data
      marketcheckValuation: reportData.marketcheck_valuation, // MarketCheck price prediction and comparables
    }

    // Generate PDF buffer
    const pdfBuffer = await renderToBuffer(<VehicleReportPDF data={pdfData} />)

    // Generate filename
    const filename = `report-${reportId}-${Date.now()}.pdf`
    const filepath = `reports/${reportData.user_id}/${filename}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('vehicle-reports')
      .upload(filepath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError)
      return { success: false, error: 'Failed to upload PDF' }
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('vehicle-reports').getPublicUrl(filepath)

    // Update report with PDF URL and status
    const { error: updateError } = await supabase
      .from('reports')
      .update({
        pdf_url: urlData.publicUrl,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)

    if (updateError) {
      console.error('Error updating report:', updateError)
      return { success: false, error: 'Failed to update report' }
    }

    return {
      success: true,
      pdfUrl: urlData.publicUrl,
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
    const supabase = await createServerSupabaseClient()
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
    const reportType = reportData.price_paid === 2900 ? 'BASIC' : 'PREMIUM'

    const pdfData = {
      vin: reportData.vin,
      reportType: reportType as 'BASIC' | 'PREMIUM',
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
