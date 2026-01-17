'use client'

import { useEffect } from 'react'
import { trackReportWorkflow } from '@/lib/analytics/events'

interface ReportViewTrackerProps {
  reportId: string
  vehicleYear?: number
  vehicleMake?: string
  vehicleModel?: string
}

export function ReportViewTracker({ reportId, vehicleYear, vehicleMake, vehicleModel }: ReportViewTrackerProps) {
  useEffect(() => {
    trackReportWorkflow({
      step: 'report_viewed',
      reportId,
      vehicleYear,
      vehicleMake,
      vehicleModel,
    })
  }, [reportId, vehicleYear, vehicleMake, vehicleModel])

  return null
}
