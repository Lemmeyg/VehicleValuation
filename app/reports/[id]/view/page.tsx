/**
 * Elite Vehicle Valuation Report View
 *
 * Matches the exact design from Elite Vehicle Valuation Report.pdf
 */

import { getUser } from '@/lib/db/auth'
import { createServerSupabaseClient } from '@/lib/db/supabase'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Car,
  Download,
  FileText,
  AlertTriangle
} from 'lucide-react'
import { getClosestMileageListings, getListingsStats } from '@/lib/utils/listing-filters'
import { MarketCharts } from '@/components/MarketCharts'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ReportViewPage({ params }: PageProps) {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }

  const { id } = await params

  const supabase = await createServerSupabaseClient()

  // Fetch report data
  const { data: report, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Report Not Found</h1>
          <p className="mt-2 text-gray-600">
            The report you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
          </p>
          <Link href="/dashboard" className="mt-4 inline-block text-blue-600 hover:text-blue-500">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const autodevData = report.autodev_vin_data as any
  const marketCheck = report.marketcheck_valuation as any
  const pdfUrl = report.pdf_url as string | null

  // Get ALL listings from database (no filtering yet)
  const allListings = marketCheck?.recentComparables?.listings || marketCheck?.comparables || []

  // Filter to 10 vehicles with mileage closest to subject vehicle
  const displayedComparables = getClosestMileageListings(allListings, report.mileage || 0, 10)

  // Get statistics from ALL listings
  const listingsStats = getListingsStats(allListings)

  // Calculate values from MarketCheck (primary source)
  const estimatedValue = marketCheck?.predictedPrice || 0
  const lowRange = marketCheck?.priceRange?.min || Math.round(estimatedValue * 0.9)
  const fairMarket = estimatedValue
  const highRange = marketCheck?.priceRange?.max || Math.round(estimatedValue * 1.1)
  const totalComparables = marketCheck?.totalComparablesFound || allListings.length || 0
  const confidence = marketCheck?.confidence || 'medium'

  // Helper to format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Helper to render values
  const renderValue = (value: unknown, fallback = 'N/A'): string => {
    if (value === null || value === undefined) return fallback
    return String(value)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900">
                ← Back to Dashboard
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <button className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                <FileText className="h-4 w-4 mr-2" />
                Print
              </button>
              <button className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
                Share
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Report Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-slate-500 tracking-wide uppercase">
              VEHICLE VALUATION REPORT › ID: {report.id.substring(0, 8).toUpperCase()}
            </div>
            <div className="text-xs text-slate-500">
              Report Date: {new Date(report.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
            </div>
          </div>
          <h1 className="text-5xl font-bold text-slate-900 mb-1">
            {autodevData?.vehicle?.year} {autodevData?.make} {autodevData?.model}
          </h1>
          <p className="text-slate-600 text-sm font-mono">{report.vin}</p>
        </div>

        {/* Market Value Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Low Range */}
          <div className="bg-white border-l-4 border-slate-400 rounded-lg p-6 shadow-sm">
            <div className="text-xs font-semibold text-slate-600 tracking-wide uppercase mb-2">
              LOW RANGE
            </div>
            <div className="text-4xl font-bold text-slate-900 mb-1">
              {formatCurrency(lowRange)}
            </div>
            <div className="text-xs text-slate-500">Market floor estimate</div>
          </div>

          {/* Market Value - Primary */}
          <div className="bg-white border-l-4 border-emerald-500 rounded-lg p-6 shadow-sm">
            <div className="text-xs font-semibold text-emerald-600 tracking-wide uppercase mb-2">
              MARKET VALUE
            </div>
            <div className="text-4xl font-bold text-slate-900 mb-1">
              {formatCurrency(estimatedValue)}
            </div>
            <div className="text-xs text-slate-500">{confidence.toUpperCase()} CONFIDENCE</div>
          </div>

          {/* High Range */}
          <div className="bg-white border-l-4 border-blue-500 rounded-lg p-6 shadow-sm">
            <div className="text-xs font-semibold text-blue-600 tracking-wide uppercase mb-2">
              HIGH RANGE
            </div>
            <div className="text-4xl font-bold text-slate-900 mb-1">
              {formatCurrency(highRange)}
            </div>
            <div className="text-xs text-slate-500">Market ceiling estimate</div>
          </div>
        </div>

        {/* Vehicle Specifications */}
        <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8">
          <div className="flex items-center mb-6">
            <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center mr-3">
              <FileText className="h-5 w-5 text-slate-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Vehicle Specifications</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-x-8 gap-y-6">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Year</div>
              <div className="text-base font-medium text-slate-900">{autodevData?.vehicle?.year || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Make</div>
              <div className="text-base font-medium text-slate-900">{autodevData?.make || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Mileage</div>
              <div className="text-base font-medium text-slate-900">
                {report.mileage ? `${report.mileage.toLocaleString()} mi` : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Model</div>
              <div className="text-base font-medium text-slate-900">{autodevData?.model || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Trim</div>
              <div className="text-base font-medium text-slate-900">{autodevData?.trim || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Body Style</div>
              <div className="text-base font-medium text-slate-900">{autodevData?.body || autodevData?.style || 'N/A'}</div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Engine</div>
              <div className="text-base font-medium text-slate-900">{autodevData?.engine || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Transmission</div>
              <div className="text-base font-medium text-slate-900">{autodevData?.transmission || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Drive Type</div>
              <div className="text-base font-medium text-slate-900">{autodevData?.drive || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Vehicle Type</div>
              <div className="text-base font-medium text-slate-900">{autodevData?.type || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Origin</div>
              <div className="text-base font-medium text-slate-900">{autodevData?.origin || 'N/A'}</div>
            </div>
          </div>
        </div>

        {/* Market Distribution & Analysis */}
        <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Market Distribution & Analysis</h2>
            <div className={`text-xs font-semibold tracking-wide uppercase ${
              confidence === 'high' ? 'text-emerald-600' :
              confidence === 'medium' ? 'text-blue-600' :
              'text-amber-600'
            }`}>
              CONFIDENCE: {confidence.toUpperCase()}
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-8">
            Based on {allListings.length} live comparable listings from recent market data
          </p>

          {/* Interactive Charts */}
          {allListings.length > 0 ? (
            <MarketCharts
              listings={allListings}
              displayedComparables={displayedComparables}
              estimatedValue={estimatedValue}
              lowRange={lowRange}
              highRange={highRange}
              subjectVehicle={{
                mileage: report.mileage || 0,
                year: autodevData?.vehicle?.year,
                make: autodevData?.make,
                model: autodevData?.model,
              }}
            />
          ) : (
            <div className="text-center py-12 text-slate-500">
              No comparable listings available for visualization
            </div>
          )}

          {/* Value Boxes */}
          <div className="grid grid-cols-3 gap-6 mt-8 pt-8 border-t border-slate-200">
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Low Range</div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(lowRange)}</div>
            </div>
            <div className="text-center p-4 bg-emerald-50 rounded-lg border-2 border-emerald-200">
              <div className="text-xs font-semibold text-emerald-600 uppercase mb-2">Fair Market Value</div>
              <div className="text-2xl font-bold text-emerald-700">{formatCurrency(fairMarket)}</div>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">High Range</div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(highRange)}</div>
            </div>
          </div>
        </div>

        {/* Market Comparables */}
        <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center mr-3">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Market Comparables</h2>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Showing 10 closest by mileage of {allListings.length} listings</div>
              <div className="text-xs text-slate-600 mt-1">
                Avg: {formatCurrency(listingsStats.avgPrice)} • Range: {formatCurrency(listingsStats.minPrice)} - {formatCurrency(listingsStats.maxPrice)}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Photo</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Vehicle Details</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Mileage</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Market Price</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Days on Market</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Dealer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedComparables.map((comp: any, idx: number) => {
                  // Extract dealer homepage URL from vdp_url
                  const getDealerHomepage = (vdpUrl?: string) => {
                    if (!vdpUrl) return null
                    try {
                      const url = new URL(vdpUrl)
                      return `${url.protocol}//${url.hostname}`
                    } catch {
                      return null
                    }
                  }
                  const dealerHomepage = getDealerHomepage(comp.vdp_url)

                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-4 px-4">
                        {comp.photo_url ? (
                          <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-slate-100">
                            <Image
                              src={comp.photo_url}
                              alt={`${comp.year} ${comp.make} ${comp.model}`}
                              fill
                              className="object-cover"
                              sizes="96px"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="w-24 h-16 rounded-lg bg-slate-100 flex items-center justify-center">
                            <Car className="h-8 w-8 text-slate-400" />
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-900">
                          {comp.year} {comp.make} {comp.model}
                        </div>
                        <div className="text-sm text-slate-500">{comp.trim}</div>
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-700">
                        {(comp.miles || comp.mileage)?.toLocaleString() || 'N/A'} mi
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-base font-bold text-emerald-600">
                          {formatCurrency(comp.price)}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-700">
                        {comp.dom_180 || comp.dom || 'N/A'}
                      </td>
                      <td className="py-4 px-4">
                        {dealerHomepage && comp.dealer_name ? (
                          <a
                            href={dealerHomepage}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          >
                            {comp.dealer_name}
                          </a>
                        ) : (
                          <span className="text-slate-700">
                            {comp.dealer_name || 'N/A'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Additional Valuation Considerations */}
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-8">
          <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide mb-4">
            Additional Valuation Considerations
          </h3>
          <div className="prose prose-sm max-w-none text-slate-600 space-y-4">
            <p className="font-semibold text-slate-700">
              Note: The following undocumented factors can significantly impact your vehicle&apos;s actual cash value. Documenting these conditions with photos and records strengthens your position when contesting an insurance settlement offer.
            </p>

            <div className="space-y-3">
              <div>
                <span className="font-semibold text-slate-900">Physical Condition:</span> Overall vehicle condition (Excellent to Poor) based on exterior paint quality, body damage, rust, interior upholstery wear, and mechanical condition of engine, transmission, and brakes. <span className="text-slate-700 italic">Impact: -20% (poor) to +12% (excellent)</span>
              </div>

              <div>
                <span className="font-semibold text-slate-900">Accident & Title History:</span> Clean title vs. salvage/rebuilt, documented accident history, and number of previous owners. One-owner vehicles with clean titles command premiums. <span className="text-slate-700 italic">Impact: -50% (salvage) to +8% (1-owner clean)</span>
              </div>

              <div>
                <span className="font-semibold text-slate-900">Service Records:</span> Well-documented maintenance history with receipts from authorized dealers or reputable shops demonstrates proper care and increases buyer confidence. <span className="text-slate-700 italic">Impact: +5% to +10%</span>
              </div>

              <div>
                <span className="font-semibold text-slate-900">Factory Options & Equipment:</span> Premium features including navigation systems, sunroof, heated/ventilated seats, advanced safety packages, leather interior, and technology upgrades add measurable value. <span className="text-slate-700 italic">Impact: +3% to +15%</span>
              </div>

              <div>
                <span className="font-semibold text-slate-900">Vehicle Usage & Environment:</span> Non-smoker vehicles, garage-kept storage, personal use (vs. fleet/rental/rideshare), and climate history (rust-belt vs. sun-belt) affect long-term condition and desirability. <span className="text-slate-700 italic">Impact: -15% (smoking) to +8% (garage-kept)</span>
              </div>

              <div>
                <span className="font-semibold text-slate-900">Documentation Quality:</span> Presence of both key fobs, owner&apos;s manual, service records, original equipment (spare tire, jack, tools), and proof of recall completion demonstrates thorough ownership. <span className="text-slate-700 italic">Impact: +2% to +5%</span>
              </div>

              <div>
                <span className="font-semibold text-slate-900">Regional Factors:</span> 4WD/AWD commands premium in snow states, convertibles more valuable in warm climates, diesel trucks in rural areas, and fuel efficiency during high gas prices. <span className="text-slate-700 italic">Impact: +5% to +15% (region-dependent)</span>
              </div>

              <div>
                <span className="font-semibold text-slate-900">Recent Maintenance:</span> New tires, recent brake service, fresh oil change, new battery, or completed major services (timing belt, transmission service) add immediate value. <span className="text-slate-700 italic">Impact: +$500 to $2,000</span>
              </div>

              <div>
                <span className="font-semibold text-slate-900">Special Circumstances:</span> Limited edition models, performance variants, anniversary editions, remaining factory warranty, prepaid maintenance plans, and unrepaired recall status all affect market value. <span className="text-slate-700 italic">Impact: varies significantly</span>
              </div>

              <div>
                <span className="font-semibold text-slate-900">Aftermarket Modifications:</span> Quality additions like remote start or premium audio can add value, while excessive modifications, lowering kits, or poor-quality work typically decrease value. <span className="text-slate-700 italic">Impact: -10% to +5%</span>
              </div>
            </div>

            <p className="pt-4 border-t border-slate-300 font-semibold text-slate-900">
              Recommendation: Photograph and document all positive factors listed above. For professional assistance with appraisals, inspections, or claims support, visit our <Link href="/services" className="text-emerald-600 hover:text-emerald-700 underline">Professional Services Directory</Link>.
            </p>
          </div>

          {/* Action Plan CTA */}
          <div className="mt-12 mb-8 flex justify-center">
            <Link
              href={`/reports/${id}/action-plan`}
              className="inline-flex items-center px-8 py-4 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors shadow-lg text-lg"
            >
              <FileText className="h-6 w-6 mr-2" />
              View Your Next Steps Action Plan
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-300 text-xs text-slate-500 space-y-2">
            <p>
              This valuation report is intended for informational purposes only and does not constitute a professional appraisal, legal advice, or binding offer. Valuations use proprietary algorithms aggregating data from VinAudit, Auto.dev, CarsXE, and MarketCheck. Vehicle market values are subject to rapid change based on local demand, condition variances, and economic fluctuations. Consult with a certified appraiser or insurance adjuster for final settlement figures.
            </p>
            <div className="flex items-center justify-between pt-4">
              <div>© 2024 ELITE VALUATION SERVICES</div>
              <div className="flex space-x-4">
                <Link href="/terms" className="hover:text-slate-700">TERMS OF SERVICE</Link>
                <Link href="/privacy" className="hover:text-slate-700">PRIVACY POLICY</Link>
                <Link href="/contact" className="hover:text-slate-700">CONTACT SUPPORT</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
