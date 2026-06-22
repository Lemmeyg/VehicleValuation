import { getUser } from '@/lib/db/auth'
import { supabaseAdmin } from '@/lib/db/supabase'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { canViewReport } from '@/lib/utils/report-access'
import { getLowestDOSActiveListings, getListingsStats } from '@/lib/utils/listing-filters'
import { MarketCharts } from '@/components/MarketCharts'
import { PrintToolbar } from './PrintToolbar'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}

export default async function PrintPage({ params, searchParams }: PageProps) {
  const user = await getUser()
  const { id } = await params
  const { token } = await searchParams

  let isTokenAccess = false

  if (!user) {
    if (!token) {
      redirect(`/auth?redirect=/reports/${id}/print`)
    }

    const { data: tokenReport } = await supabaseAdmin
      .from('reports')
      .select('access_token, access_token_expires_at')
      .eq('id', id)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storedToken = (tokenReport as any)?.access_token as string | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expiresAt = (tokenReport as any)?.access_token_expires_at as string | null

    const tokenValid =
      storedToken != null &&
      storedToken === token &&
      expiresAt != null &&
      new Date(expiresAt) > new Date()

    if (!tokenValid) {
      redirect(`/auth?redirect=/reports/${id}/print&reason=token_expired`)
    }

    isTokenAccess = true
  }

  const isAdmin = user?.user_metadata?.is_admin === true

  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !report) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Report Not Found</h1>
          <p className="mt-2 text-gray-600">
            This report does not exist or you do not have access.
          </p>
          <Link href="/dashboard" className="mt-4 inline-block text-blue-600 hover:text-blue-500">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (!isTokenAccess && !canViewReport(user?.id ?? '', isAdmin, report.user_id)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">
            This report belongs to a different account. Sign in with the email used at checkout.
          </p>
          <Link
            href={`/auth?redirect=/reports/${id}/print`}
            className="mt-4 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Sign in with a different account
          </Link>
        </div>
      </div>
    )
  }

  if (!isTokenAccess && (!report.price_paid || report.price_paid === 0)) {
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('report_id', id)
      .eq('status', 'succeeded')
      .maybeSingle()

    if (!payment) {
      redirect(`/reports/${id}`)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autodevData = report.autodev_vin_data as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const marketCheck = report.marketcheck_valuation as any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allListings: any[] =
    marketCheck?.recentComparables?.listings || marketCheck?.comparables || []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const validatedListings = allListings.filter((l: any) => l.url_validated === true)
  const displayedComparables = getLowestDOSActiveListings(
    validatedListings.length > 0 ? validatedListings : allListings,
    10
  )
  const listingsStats = getListingsStats(allListings)

  const estimatedValue = (marketCheck?.predictedPrice || 0) as number
  const lowRange = (marketCheck?.priceRange?.min || Math.round(estimatedValue * 0.9)) as number
  const highRange = (marketCheck?.priceRange?.max || Math.round(estimatedValue * 1.1)) as number

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)

  const vehicleLabel =
    `${autodevData?.vehicle?.year ?? ''} ${autodevData?.make ?? ''} ${autodevData?.model ?? ''}`.trim()

  const backHref = token ? `/reports/${id}/view?token=${token}` : `/reports/${id}/view`

  return (
    <>
      {/*
        Print CSS scoped to this page.
        @page sets margins. print-color-adjust preserves chart bar colours.
        break-inside: avoid keeps sections from splitting across pages.
      */}
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.75in; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <PrintToolbar backHref={backHref} vehicleLabel={vehicleLabel} reportId={id} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 break-inside-avoid">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-slate-500 tracking-wide uppercase">
              TOTALLOSSTOOLKIT REPORT &rsaquo; ID: {report.id.substring(0, 8).toUpperCase()}
            </div>
            <div className="text-xs text-slate-500">
              {new Date(report.created_at).toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: 'numeric',
              })}
            </div>
          </div>
          <h1 className="text-5xl font-bold text-slate-900 mb-1">{vehicleLabel}</h1>
          <p className="text-slate-600 text-sm font-mono">{report.vin}</p>
          <div className="border-b-2 border-blue-600 mt-4" />
        </div>

        {/* Market Value Cards */}
        <div className="grid grid-cols-3 gap-6 mb-10 break-inside-avoid">
          <div className="bg-white border border-slate-200 border-l-4 border-l-slate-400 rounded-lg p-5 shadow-sm">
            <div className="text-xs font-semibold text-slate-600 tracking-wide uppercase mb-2">
              LOW RANGE
            </div>
            <div className="text-4xl font-bold text-slate-900 mb-1">{formatCurrency(lowRange)}</div>
            <div className="text-xs text-slate-500">Market floor estimate</div>
          </div>
          <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-500 rounded-lg p-5 shadow-sm">
            <div className="text-xs font-semibold text-emerald-700 tracking-wide uppercase mb-2">
              MARKET VALUE
            </div>
            <div className="text-4xl font-bold text-slate-900 mb-1">
              {formatCurrency(estimatedValue)}
            </div>
            <div className="text-xs text-slate-500">
              Independent estimate ·{' '}
              {(listingsStats as { count?: number }).count ?? allListings.length} comparables
            </div>
          </div>
          <div className="bg-white border border-slate-200 border-l-4 border-l-blue-500 rounded-lg p-5 shadow-sm">
            <div className="text-xs font-semibold text-blue-700 tracking-wide uppercase mb-2">
              HIGH RANGE
            </div>
            <div className="text-4xl font-bold text-slate-900 mb-1">
              {formatCurrency(highRange)}
            </div>
            <div className="text-xs text-slate-500">Market ceiling estimate</div>
          </div>
        </div>

        {/* Vehicle Specifications */}
        {autodevData && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 mb-8 break-inside-avoid">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Vehicle Specifications</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'YEAR', value: autodevData?.vehicle?.year },
                { label: 'MAKE', value: autodevData?.make },
                { label: 'MODEL', value: autodevData?.model },
                { label: 'TRIM', value: autodevData?.trim },
                { label: 'ENGINE', value: autodevData?.engine },
                { label: 'TRANSMISSION', value: autodevData?.transmission },
                { label: 'DRIVE TYPE', value: autodevData?.drive },
                { label: 'BODY TYPE', value: autodevData?.body },
                { label: 'FUEL TYPE', value: autodevData?.type },
              ]
                .filter(item => item.value)
                .map(item => (
                  <div key={item.label}>
                    <div className="text-xs font-bold text-slate-400 mb-1">{item.label}</div>
                    <div className="text-sm font-semibold text-slate-900">{item.value}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Market Analysis Charts */}
        {allListings.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 mb-8 break-inside-avoid">
            <h2 className="text-lg font-bold text-slate-900 mb-2">Market Analysis</h2>
            <p className="text-sm text-slate-500 mb-6">
              Based on {allListings.length} comparable vehicles in your area
            </p>
            <MarketCharts
              listings={allListings}
              displayedComparables={displayedComparables}
              estimatedValue={estimatedValue}
              lowRange={lowRange}
              highRange={highRange}
              subjectVehicle={{
                mileage: report.mileage ?? 0,
                year: autodevData?.vehicle?.year,
                make: autodevData?.make,
                model: autodevData?.model,
              }}
              printMode
            />
          </div>
        )}

        {/* Comparable Listings */}
        {displayedComparables.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              Comparable Vehicles ({displayedComparables.length} shown)
            </h2>
            <div className="divide-y divide-slate-100">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {displayedComparables.map((comp: any, i: number) => (
                <div key={i} className="py-4 grid grid-cols-4 gap-4 text-sm break-inside-avoid">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {comp.year} {comp.make} {comp.model}
                    </p>
                    <p className="text-slate-500">{comp.trim}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase font-semibold mb-1">Mileage</p>
                    <p className="font-medium text-slate-900">
                      {(comp.miles ?? comp.mileage ?? 0).toLocaleString()} mi
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase font-semibold mb-1">Location</p>
                    <p className="font-medium text-slate-900">
                      {comp.city ?? comp.location?.city ?? '—'},{' '}
                      {comp.state ?? comp.location?.state ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase font-semibold mb-1">Price</p>
                    <p className="font-bold text-emerald-700">{formatCurrency(comp.price)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Watermark — print only */}
        <div className="hidden print:block text-center text-xs text-slate-400 mt-8 pt-4 border-t border-slate-200">
          Generated by TotalLossToolkit.com · Report ID: {report.id.substring(0, 8).toUpperCase()}
        </div>
      </main>
    </>
  )
}
