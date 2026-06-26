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

  const specItems = [
    { label: 'YEAR', value: autodevData?.vehicle?.year },
    { label: 'MAKE', value: autodevData?.make },
    { label: 'MODEL', value: autodevData?.model },
    { label: 'TRIM', value: autodevData?.trim },
    { label: 'ENGINE', value: autodevData?.engine },
    { label: 'TRANSMISSION', value: autodevData?.transmission },
    { label: 'DRIVE TYPE', value: autodevData?.drive },
    { label: 'BODY TYPE', value: autodevData?.body || autodevData?.style },
    { label: 'FUEL TYPE', value: autodevData?.type },
    { label: 'MILEAGE', value: report.mileage ? `${report.mileage.toLocaleString()} mi` : null },
  ].filter(item => item.value)

  return (
    <>
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.75in; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .avoid-break { break-inside: avoid; }
        }
      `}</style>

      <PrintToolbar backHref={backHref} vehicleLabel={vehicleLabel} reportId={id} />

      <main className="max-w-4xl mx-auto px-6 py-6">
        {/* ── PAGE 1: HEADER ─────────────────────────────────── */}
        <div className="mb-5 avoid-break">
          <div className="flex items-center justify-between mb-1">
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
          <h1 className="text-4xl font-bold text-slate-900 mb-1">{vehicleLabel}</h1>
          <p className="text-slate-500 text-xs font-mono">{report.vin}</p>
          <div className="border-b-2 border-blue-600 mt-3" />
        </div>

        {/* ── MARKET VALUE CARDS ─────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 mb-6 avoid-break">
          <div className="bg-white border border-slate-200 border-l-4 border-l-slate-400 rounded-lg p-4 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 tracking-wide uppercase mb-1">
              LOW RANGE
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{formatCurrency(lowRange)}</div>
            <div className="text-xs text-slate-400">Market floor estimate</div>
          </div>
          <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-500 rounded-lg p-4 shadow-sm">
            <div className="text-xs font-semibold text-emerald-700 tracking-wide uppercase mb-1">
              MARKET VALUE
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {formatCurrency(estimatedValue)}
            </div>
            <div className="text-xs text-slate-400">
              Independent estimate &middot;{' '}
              {(listingsStats as { count?: number }).count ?? allListings.length} comparables
            </div>
          </div>
          <div className="bg-white border border-slate-200 border-l-4 border-l-blue-500 rounded-lg p-4 shadow-sm">
            <div className="text-xs font-semibold text-blue-700 tracking-wide uppercase mb-1">
              HIGH RANGE
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {formatCurrency(highRange)}
            </div>
            <div className="text-xs text-slate-400">Market ceiling estimate</div>
          </div>
        </div>

        {/* ── VEHICLE SPECIFICATIONS (compact) ───────────────── */}
        {autodevData && (
          <div className="bg-white border border-slate-200 rounded-lg p-4 mb-5 avoid-break">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3">
              Vehicle Specifications
            </h2>
            <div className="grid grid-cols-5 gap-x-4 gap-y-3">
              {specItems.map(item => (
                <div key={item.label}>
                  <div className="text-xs font-bold text-slate-400 mb-0.5">{item.label}</div>
                  <div className="text-xs font-semibold text-slate-900">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MARKET ANALYSIS (charts on page 1) ─────────────── */}
        {allListings.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 mb-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Market Analysis
              </h2>
              <span className="text-xs text-slate-500">
                Based on {allListings.length} comparable vehicles
              </span>
            </div>

            {/* Charts — printMode forces side-by-side at compact dimensions */}
            <div className="avoid-break">
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

            {/* Value summary boxes */}
            <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-200 avoid-break">
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Low Range</div>
                <div className="text-lg font-bold text-slate-900">{formatCurrency(lowRange)}</div>
              </div>
              <div className="text-center p-3 bg-emerald-50 rounded-lg border-2 border-emerald-200">
                <div className="text-xs font-semibold text-emerald-600 uppercase mb-1">
                  Fair Market Value
                </div>
                <div className="text-lg font-bold text-emerald-700">
                  {formatCurrency(estimatedValue)}
                </div>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
                  High Range
                </div>
                <div className="text-lg font-bold text-slate-900">{formatCurrency(highRange)}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── COMPARABLE LISTINGS (with photos + clickable links) ── */}
        {displayedComparables.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Comparable Vehicles ({displayedComparables.length} shown)
              </h2>
              <div className="text-right text-xs text-slate-500">
                <div>{allListings.length} total listings analysed</div>
                <div>
                  Avg {formatCurrency(Math.round(listingsStats.avgPrice))} &bull; Range{' '}
                  {formatCurrency(listingsStats.minPrice)}–{formatCurrency(listingsStats.maxPrice)}
                </div>
              </div>
            </div>

            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 pr-2 font-semibold text-slate-400 uppercase w-16">
                    Photo
                  </th>
                  <th className="text-left py-2 pr-2 font-semibold text-slate-400 uppercase">
                    Vehicle
                  </th>
                  <th className="text-left py-2 pr-2 font-semibold text-slate-400 uppercase w-20">
                    Mileage
                  </th>
                  <th className="text-left py-2 pr-2 font-semibold text-slate-400 uppercase w-20">
                    Price
                  </th>
                  <th className="text-left py-2 pr-2 font-semibold text-slate-400 uppercase w-24">
                    Location
                  </th>
                  <th className="text-left py-2 font-semibold text-slate-400 uppercase">
                    Dealer / Listing
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {displayedComparables.map((comp: any, i: number) => (
                  <tr key={i} className="avoid-break">
                    <td className="py-2 pr-2 align-top">
                      {comp.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={comp.photo_url as string}
                          alt={`${comp.year} ${comp.make} ${comp.model}`}
                          className="w-16 h-11 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-11 bg-slate-100 rounded flex items-center justify-center text-slate-400 text-xs">
                          No photo
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <div className="font-semibold text-slate-900">
                        {comp.year} {comp.make} {comp.model}
                      </div>
                      {comp.trim && <div className="text-slate-500">{comp.trim}</div>}
                    </td>
                    <td className="py-2 pr-2 align-top text-slate-700">
                      {((comp.miles || comp.mileage || 0) as number).toLocaleString()} mi
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <span className="font-bold text-emerald-700">
                        {formatCurrency(comp.price as number)}
                      </span>
                    </td>
                    <td className="py-2 pr-2 align-top text-slate-700">
                      {comp.city ?? comp.location?.city ?? '—'},{' '}
                      {comp.state ?? comp.location?.state ?? '—'}
                    </td>
                    <td className="py-2 align-top">
                      {comp.vdp_url ? (
                        <a
                          href={comp.vdp_url as string}
                          className="text-blue-600 underline break-all"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {(comp.dealer_name as string) || 'View Listing'}
                        </a>
                      ) : (
                        <span className="text-slate-700">
                          {(comp.dealer_name as string) || '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── ADDITIONAL VALUATION CONSIDERATIONS ────────────── */}
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-6 mb-5">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3 text-center">
            Additional Valuation Considerations
          </h2>
          <p className="text-xs font-semibold text-slate-700 text-center mb-4">
            Note: The following undocumented factors can significantly impact your vehicle&apos;s
            actual cash value. Documenting these conditions with photos and records strengthens your
            position when contesting an insurance settlement offer.
          </p>

          <div className="space-y-2 text-xs text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">Physical Condition: </span>
              Overall vehicle condition (Excellent to Poor) based on exterior paint quality, body
              damage, rust, interior upholstery wear, and mechanical condition of engine,
              transmission, and brakes.{' '}
              <span className="font-bold text-slate-900">
                Impact: -20% (poor) to +12% (excellent)
              </span>
            </p>

            <p>
              <span className="font-semibold text-slate-900">Accident &amp; Title History: </span>
              Clean title vs. salvage/rebuilt, documented accident history, and number of previous
              owners. One-owner vehicles with clean titles command premiums.{' '}
              <span className="font-bold text-slate-900">
                Impact: -50% (salvage) to +8% (1-owner clean)
              </span>
            </p>

            <p>
              <span className="font-semibold text-slate-900">Service Records: </span>
              Well-documented maintenance history with receipts from authorized dealers or reputable
              shops demonstrates proper care and increases buyer confidence.{' '}
              <span className="font-bold text-slate-900">Impact: +5% to +10%</span>
            </p>

            <p>
              <span className="font-semibold text-slate-900">
                Factory Options &amp; Equipment:{' '}
              </span>
              Premium features including navigation systems, sunroof, heated/ventilated seats,
              advanced safety packages, leather interior, and technology upgrades add measurable
              value. <span className="font-bold text-slate-900">Impact: +3% to +15%</span>
            </p>

            <p>
              <span className="font-semibold text-slate-900">
                Vehicle Usage &amp; Environment:{' '}
              </span>
              Non-smoker vehicles, garage-kept storage, personal use (vs. fleet/rental/rideshare),
              and climate history (rust-belt vs. sun-belt) affect long-term condition and
              desirability.{' '}
              <span className="font-bold text-slate-900">
                Impact: -15% (smoking) to +8% (garage-kept)
              </span>
            </p>

            <p>
              <span className="font-semibold text-slate-900">Documentation Quality: </span>
              Presence of both key fobs, owner&apos;s manual, service records, original equipment
              (spare tire, jack, tools), and proof of recall completion demonstrates thorough
              ownership. <span className="font-bold text-slate-900">Impact: +2% to +5%</span>
            </p>

            <p>
              <span className="font-semibold text-slate-900">Regional Factors: </span>
              4WD/AWD commands premium in snow states, convertibles more valuable in warm climates,
              diesel trucks in rural areas, and fuel efficiency during high gas prices.{' '}
              <span className="font-bold text-slate-900">
                Impact: +5% to +15% (region-dependent)
              </span>
            </p>

            <p>
              <span className="font-semibold text-slate-900">Recent Maintenance: </span>
              New tires, recent brake service, fresh oil change, new battery, or completed major
              services (timing belt, transmission service) add immediate value.{' '}
              <span className="font-bold text-slate-900">Impact: +$500 to $2,000</span>
            </p>

            <p>
              <span className="font-semibold text-slate-900">Special Circumstances: </span>
              Limited edition models, performance variants, anniversary editions, remaining factory
              warranty, prepaid maintenance plans, and unrepaired recall status all affect market
              value. <span className="font-bold text-slate-900">Impact: varies significantly</span>
            </p>

            <p>
              <span className="font-semibold text-slate-900">Aftermarket Modifications: </span>
              Quality additions like remote start or premium audio can add value, while excessive
              modifications, lowering kits, or poor-quality work typically decrease value.{' '}
              <span className="font-bold text-slate-900">Impact: -10% to +5%</span>
            </p>
          </div>

          <p className="mt-4 pt-4 border-t border-slate-300 text-xs font-semibold text-slate-900">
            Recommendation: Photograph and document all positive factors listed above. For
            professional assistance with appraisals, inspections, or claims support, visit our{' '}
            <a href="/services" className="text-emerald-600 underline">
              Professional Services Directory
            </a>{' '}
            at totallosstoolkit.com/services.
          </p>
        </div>

        {/* ── DISCLAIMER ─────────────────────────────────────── */}
        <div className="text-xs text-slate-500 space-y-2 mb-4">
          <p>
            This valuation report is intended for informational purposes only and does not
            constitute a professional appraisal, legal advice, or binding offer. Valuations use
            proprietary algorithms aggregating data from Auto.dev and MarketCheck. Vehicle market
            values are subject to rapid change based on local demand, condition variances, and
            economic fluctuations. Consult with a certified appraiser or insurance adjuster for
            final settlement figures.
          </p>
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <span>© {new Date().getFullYear()} TotalLossToolkit.com</span>
            <div className="flex space-x-4">
              <a href="/terms" className="hover:text-slate-700 underline">
                Terms of Service
              </a>
              <a href="/privacy" className="hover:text-slate-700 underline">
                Privacy Policy
              </a>
              <a href="/contact" className="hover:text-slate-700 underline">
                Contact Support
              </a>
            </div>
          </div>
        </div>

        {/* Print-only footer watermark */}
        <div className="hidden print:block text-center text-xs text-slate-400 mt-6 pt-3 border-t border-slate-200">
          Generated by TotalLossToolkit.com &middot; Report ID:{' '}
          {report.id.substring(0, 8).toUpperCase()}
        </div>
      </main>
    </>
  )
}
