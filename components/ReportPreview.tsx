'use client'

import { Car, FileText } from 'lucide-react'

/**
 * Report Preview Component
 *
 * Visual representation of the Elite Vehicle Valuation Report
 * Matches the exact design from /reports/[id]/view
 * Based on 2021 BMW X3 report (ID: b775f192-c577-46cd-a724-50569c40d2cd)
 */

export default function ReportPreview() {
  return (
    <div
      className="bg-white rounded-lg shadow-lg overflow-hidden"
      style={{ height: '800px', overflowY: 'auto' }}
    >
      <div className="p-10">
        {/* Report Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-slate-500 tracking-wide uppercase">
              VEHICLE VALUATION REPORT › ID: B775F192
            </div>
            <div className="text-xs text-slate-500">Report Date: 12/30/2024</div>
          </div>
          <h1 className="text-6xl font-bold text-slate-900 mb-2">2021 BMW X3</h1>
          <p className="text-slate-600 text-base font-mono">5UX23DT04M9J17140</p>
        </div>

        {/* Market Value Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Low Range */}
          <div className="bg-white border-l-4 border-slate-400 rounded-lg p-8 shadow-sm">
            <div className="text-sm font-semibold text-slate-600 tracking-wide uppercase mb-3">
              LOW RANGE
            </div>
            <div className="text-5xl font-bold text-slate-900 mb-2">$20,389</div>
            <div className="text-sm text-slate-500">Market floor estimate</div>
          </div>

          {/* Market Value - Primary */}
          <div className="bg-white border-l-4 border-emerald-500 rounded-lg p-8 shadow-sm">
            <div className="text-sm font-semibold text-emerald-600 tracking-wide uppercase mb-3">
              MARKET VALUE
            </div>
            <div className="text-5xl font-bold text-slate-900 mb-2">$22,654</div>
            <div className="text-sm text-slate-500">HIGH CONFIDENCE</div>
          </div>

          {/* High Range */}
          <div className="bg-white border-l-4 border-blue-500 rounded-lg p-8 shadow-sm">
            <div className="text-sm font-semibold text-blue-600 tracking-wide uppercase mb-3">
              HIGH RANGE
            </div>
            <div className="text-5xl font-bold text-slate-900 mb-2">$24,919</div>
            <div className="text-sm text-slate-500">Market ceiling estimate</div>
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

          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-8">
            <div>
              <div className="text-sm font-semibold text-slate-500 uppercase mb-2">Year</div>
              <div className="text-lg font-medium text-slate-900">2021</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-500 uppercase mb-2">Make</div>
              <div className="text-lg font-medium text-slate-900">BMW</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-500 uppercase mb-2">Model</div>
              <div className="text-lg font-medium text-slate-900">X3</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-500 uppercase mb-2">Mileage</div>
              <div className="text-lg font-medium text-slate-900">63,227 mi</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-500 uppercase mb-2">Trim</div>
              <div className="text-lg font-medium text-slate-900">
                xDrive30i SAV
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-500 uppercase mb-2">Body Style</div>
              <div className="text-lg font-medium text-slate-900">SUV</div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-500 uppercase mb-2">Engine</div>
              <div className="text-lg font-medium text-slate-900">2.0L I4</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-500 uppercase mb-2">
                Transmission
              </div>
              <div className="text-lg font-medium text-slate-900">Automatic</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-500 uppercase mb-2">Drive Type</div>
              <div className="text-lg font-medium text-slate-900">AWD</div>
            </div>
          </div>
        </div>

        {/* Market Distribution & Analysis */}
        <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Market Distribution & Analysis</h2>
            <div className="text-xs font-semibold tracking-wide uppercase text-emerald-600">
              CONFIDENCE: HIGH
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-8">
            Based on 187 live comparable listings from recent market data
          </p>

          {/* Interactive Charts Placeholder */}
          <div className="bg-slate-50 rounded-lg p-6 mb-6">
            <div className="text-center text-slate-500 text-sm mb-4">
              Interactive Price Distribution & Mileage Analysis Charts
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* Bar Chart Placeholder */}
              <div className="relative h-48 bg-white rounded border border-slate-200 p-4">
                <div className="text-xs text-slate-600 mb-2 font-semibold">Price Distribution</div>
                <svg viewBox="0 0 300 150" className="w-full h-full">
                  <rect x="20" y="100" width="25" height="40" fill="rgb(203, 213, 225)" />
                  <rect x="50" y="80" width="25" height="60" fill="rgb(148, 163, 184)" />
                  <rect x="80" y="60" width="25" height="80" fill="rgb(100, 116, 139)" />
                  <rect x="110" y="30" width="25" height="110" fill="rgb(16, 185, 129)" />
                  <rect x="140" y="20" width="25" height="120" fill="rgb(16, 185, 129)" />
                  <rect x="170" y="30" width="25" height="110" fill="rgb(16, 185, 129)" />
                  <rect x="200" y="60" width="25" height="80" fill="rgb(100, 116, 139)" />
                  <rect x="230" y="80" width="25" height="60" fill="rgb(148, 163, 184)" />
                  <rect x="260" y="100" width="25" height="40" fill="rgb(203, 213, 225)" />
                  <line
                    x1="152"
                    y1="10"
                    x2="152"
                    y2="140"
                    stroke="rgb(16, 185, 129)"
                    strokeWidth="2"
                    strokeDasharray="4,4"
                  />
                </svg>
              </div>
              {/* Scatter Plot Placeholder */}
              <div className="relative h-48 bg-white rounded border border-slate-200 p-4">
                <div className="text-xs text-slate-600 mb-2 font-semibold">
                  Price vs. Mileage Analysis
                </div>
                <svg viewBox="0 0 300 150" className="w-full h-full">
                  {[...Array(30)].map((_, i) => {
                    // Generate deterministic positions based on index for consistency across renders
                    const cx = 20 + ((i * 23) % 260)
                    const cy = 20 + ((i * 17) % 110)
                    return (
                      <circle
                        key={i}
                        cx={cx}
                        cy={cy}
                        r="3"
                        fill={
                          i < 10
                            ? 'rgb(16, 185, 129)'
                            : i < 20
                              ? 'rgb(59, 130, 246)'
                              : 'rgb(100, 116, 139)'
                        }
                        opacity="0.6"
                      />
                    )
                  })}
                </svg>
              </div>
            </div>
          </div>

          {/* Value Boxes */}
          <div className="grid grid-cols-3 gap-6 mt-8 pt-8 border-t border-slate-200">
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Low Range</div>
              <div className="text-2xl font-bold text-slate-900">$20,389</div>
            </div>
            <div className="text-center p-4 bg-emerald-50 rounded-lg border-2 border-emerald-200">
              <div className="text-xs font-semibold text-emerald-600 uppercase mb-2">
                Fair Market Value
              </div>
              <div className="text-2xl font-bold text-emerald-700">$22,654</div>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">High Range</div>
              <div className="text-2xl font-bold text-slate-900">$24,919</div>
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
              <div className="text-xs text-slate-500">
                Showing 10 closest by mileage of 187 listings
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Avg: $22,800 • Range: $19,495 - $25,820
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                    Photo
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                    Vehicle Details
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                    Mileage
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                    Market Price
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                    Days on Market
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">
                    Dealer
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  {
                    trim: 'xDrive30i',
                    mileage: '57,905',
                    price: '$23,237',
                    dom: '44',
                    dealer: 'Toyota Sports Center',
                  },
                  {
                    trim: 'xDrive30i',
                    mileage: '67,369',
                    price: '$22,863',
                    dom: '96',
                    dealer: 'Norm Reeves Honda',
                  },
                  {
                    trim: 'xDrive30i',
                    mileage: '69,432',
                    price: '$21,563',
                    dom: '90',
                    dealer: 'Walser Hyundai',
                  },
                  {
                    trim: 'xDrive30i',
                    mileage: '61,484',
                    price: '$21,160',
                    dom: '48',
                    dealer: 'Schomp Chevrolet Buick GMC',
                  },
                  {
                    trim: 'xDrive30i',
                    mileage: '51,799',
                    price: '$22,050',
                    dom: '8',
                    dealer: 'Rick Case Mazda',
                  },
                  {
                    trim: 'xDrive30i',
                    mileage: '63,265',
                    price: '$23,236',
                    dom: '37',
                    dealer: 'Elliot Auto Lounge',
                  },
                  {
                    trim: 'xDrive30i',
                    mileage: '64,309',
                    price: '$19,495',
                    dom: '218',
                    dealer: 'Florida Mitsubishi',
                  },
                  {
                    trim: 'xDrive30i',
                    mileage: '48,269',
                    price: '$24,086',
                    dom: '68',
                    dealer: 'Hudson Nissan',
                  },
                ].map((comp, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-4 px-4">
                      <div className="w-24 h-16 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Car className="h-8 w-8 text-slate-400" />
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900">2021 BMW X3</div>
                      <div className="text-sm text-slate-500">{comp.trim}</div>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-700">{comp.mileage} mi</td>
                    <td className="py-4 px-4">
                      <div className="text-base font-bold text-emerald-600">{comp.price}</div>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-700">{comp.dom}</td>
                    <td className="py-4 px-4">
                      <span className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                        {comp.dealer}
                      </span>
                    </td>
                  </tr>
                ))}
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
              Note: The following undocumented factors can significantly impact your vehicle&apos;s
              actual cash value. Documenting these conditions with photos and records strengthens
              your position when contesting an insurance settlement offer.
            </p>

            <div className="space-y-3">
              <div>
                <span className="font-semibold text-slate-900">Physical Condition:</span> Overall
                vehicle condition (Excellent to Poor) based on exterior paint quality, body damage,
                rust, interior upholstery wear, and mechanical condition of engine, transmission,
                and brakes.{' '}
                <span className="text-slate-700 italic">
                  Impact: -20% (poor) to +12% (excellent)
                </span>
              </div>

              <div>
                <span className="font-semibold text-slate-900">Accident & Title History:</span>{' '}
                Clean title vs. salvage/rebuilt, documented accident history, and number of previous
                owners. One-owner vehicles with clean titles command premiums.{' '}
                <span className="text-slate-700 italic">
                  Impact: -50% (salvage) to +8% (1-owner clean)
                </span>
              </div>

              <div>
                <span className="font-semibold text-slate-900">Service Records:</span>{' '}
                Well-documented maintenance history with receipts from authorized dealers or
                reputable shops demonstrates proper care and increases buyer confidence.{' '}
                <span className="text-slate-700 italic">Impact: +5% to +10%</span>
              </div>

              <div>
                <span className="font-semibold text-slate-900">Factory Options & Equipment:</span>{' '}
                Premium features including navigation systems, sunroof, heated/ventilated seats,
                advanced safety packages, leather interior, and technology upgrades add measurable
                value. <span className="text-slate-700 italic">Impact: +3% to +15%</span>
              </div>

              <div>
                <span className="font-semibold text-slate-900">Vehicle Usage & Environment:</span>{' '}
                Non-smoker vehicles, garage-kept storage, personal use (vs. fleet/rental/rideshare),
                and climate history (rust-belt vs. sun-belt) affect long-term condition and
                desirability.{' '}
                <span className="text-slate-700 italic">
                  Impact: -15% (smoking) to +8% (garage-kept)
                </span>
              </div>

              <div>
                <span className="font-semibold text-slate-900">Regional Factors:</span> 4WD/AWD
                commands premium in snow states, convertibles more valuable in warm climates, diesel
                trucks in rural areas, and fuel efficiency during high gas prices.{' '}
                <span className="text-slate-700 italic">
                  Impact: +5% to +15% (region-dependent)
                </span>
              </div>
            </div>

            <p className="pt-4 border-t border-slate-300 font-semibold text-slate-900">
              Recommendation: Photograph and document all positive factors listed above for
              insurance claims and negotiations.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-300 text-xs text-slate-500 space-y-2">
            <p>
              This valuation report is intended for informational purposes only and does not
              constitute a professional appraisal, legal advice, or binding offer. Valuations use
              proprietary algorithms aggregating data from VinAudit, Auto.dev, CarsXE, and
              MarketCheck. Vehicle market values are subject to rapid change based on local demand,
              condition variances, and economic fluctuations. Consult with a certified appraiser or
              insurance adjuster for final settlement figures.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
