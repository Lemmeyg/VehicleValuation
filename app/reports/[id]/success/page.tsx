/**
 * /reports/[id]/success is retired (docs/Inbox/report-delivery-prd.md §10,
 * D13) — every buyer now lands on /view. This route is kept only so an
 * old bookmarked or emailed success link still works, by forwarding every
 * query parameter (the token, checkout=complete) straight through.
 */
import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SuccessRedirectPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') query.set(key, value)
  }
  const qs = query.toString()

  redirect(`/reports/${id}/view${qs ? `?${qs}` : ''}`)
}
