/**
 * Report Details Page - DEPRECATED
 *
 * This page now redirects to the new report view page at /reports/[id]/view
 * The old design has been replaced with a modern design.
 */

import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ReportDetailsPage({ params }: PageProps) {
  const { id } = await params

  // Redirect to the new modern report view page
  redirect(`/reports/${id}/view`)
}
