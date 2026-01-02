'use client'

import { Car } from 'lucide-react'

/**
 * Condensed Report Preview Component
 *
 * Simplified version showing only key sections that fit in hero
 * Based on actual report screenshots - no scrolling needed
 */

export default function ReportPreviewCondensed() {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-8">
        {/* Report Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-slate-500 tracking-wide uppercase">
              VEHICLE VALUATION REPORT › ID: B775F192
            </div>
            <div className="text-xs text-slate-500">Report Date: 12/29/2025</div>
          </div>
          <h1 className="text-5xl font-bold text-slate-900 mb-2">2021 BMW X3</h1>
          <p className="text-slate-600 text-sm font-mono">5UXTY5C20M9D79146</p>
        </div>

        {/* Market Value Cards */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {/* Low Range */}
          <div className="bg-white border-l-4 border-slate-400 rounded-lg p-5 shadow-sm">
            <div className="text-xs font-semibold text-slate-600 tracking-wide uppercase mb-2">
              LOW RANGE
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">$20,389</div>
            <div className="text-xs text-slate-500">Market floor estimate</div>
          </div>

          {/* Market Value - Primary */}
          <div className="bg-white border-l-4 border-emerald-500 rounded-lg p-5 shadow-sm">
            <div className="text-xs font-semibold text-emerald-600 tracking-wide uppercase mb-2">
              MARKET VALUE
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">$22,654</div>
            <div className="text-xs text-emerald-600 font-semibold">MEDIUM CONFIDENCE</div>
          </div>

          {/* High Range */}
          <div className="bg-white border-l-4 border-blue-500 rounded-lg p-5 shadow-sm">
            <div className="text-xs font-semibold text-blue-600 tracking-wide uppercase mb-2">
              HIGH RANGE
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">$24,919</div>
            <div className="text-xs text-slate-500">Market ceiling estimate</div>
          </div>
        </div>

        {/* Vehicle Specifications */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
          <div className="flex items-center mb-5">
            <div className="h-8 w-8 bg-slate-100 rounded-full flex items-center justify-center mr-2">
              <svg className="h-4 w-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Vehicle Specifications</h2>
          </div>

          <div className="grid grid-cols-3 gap-x-6 gap-y-5">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Year</div>
              <div className="text-sm font-medium text-slate-900">2021</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Make</div>
              <div className="text-sm font-medium text-slate-900">BMW</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Mileage</div>
              <div className="text-sm font-medium text-slate-900">67,027 mi</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Model</div>
              <div className="text-sm font-medium text-slate-900">X3</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Trim</div>
              <div className="text-sm font-medium text-slate-900">xDrive30i Sports Activity Vehicle</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Body Style</div>
              <div className="text-sm font-medium text-slate-900">Sport Utility Vehicle (SUV)</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Engine</div>
              <div className="text-sm font-medium text-slate-900">2.0, 4 Cylinder Engine</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Transmission</div>
              <div className="text-sm font-medium text-slate-900">Automatic</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Drive Type</div>
              <div className="text-sm font-medium text-slate-900">All Wheel Drive</div>
            </div>
          </div>
        </div>

        {/* Market Distribution & Analysis */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900">Market Distribution & Analysis</h2>
            <div className="text-xs font-semibold tracking-wide uppercase text-emerald-600">
              CONFIDENCE: MEDIUM
            </div>
          </div>
          <p className="text-xs text-slate-600 mb-6">
            Based on 158 live comparable listings from recent market data
          </p>

          {/* Charts Grid - Two charts side by side */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            {/* Price Distribution Chart */}
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="mb-3">
                <div className="text-xs font-semibold text-slate-700 mb-1">Price Distribution</div>
                <div className="text-[9px] text-slate-500">Distribution of 158 comparable vehicles</div>
              </div>

              {/* Bar chart */}
              <div className="relative h-36 flex items-end justify-center gap-1 px-2">
                {/* Price range bars */}
                <div className="flex flex-col items-center flex-1">
                  <div className="w-full bg-slate-300 rounded-t transition-all hover:bg-slate-400" style={{ height: '25%' }}></div>
                  <div className="text-[8px] text-slate-600 mt-1 text-center">$19-21k</div>
                </div>
                <div className="flex flex-col items-center flex-1">
                  <div className="w-full bg-slate-300 rounded-t transition-all hover:bg-slate-400" style={{ height: '40%' }}></div>
                  <div className="text-[8px] text-slate-600 mt-1 text-center">$21-23k</div>
                </div>
                <div className="flex flex-col items-center flex-1">
                  <div className="w-full bg-emerald-500 rounded-t transition-all hover:bg-emerald-600" style={{ height: '85%' }}></div>
                  <div className="text-[8px] text-emerald-700 mt-1 font-semibold text-center">$23-25k</div>
                </div>
                <div className="flex flex-col items-center flex-1">
                  <div className="w-full bg-emerald-500 rounded-t transition-all hover:bg-emerald-600" style={{ height: '100%' }}></div>
                  <div className="text-[8px] text-emerald-700 mt-1 font-semibold text-center">$25-27k</div>
                </div>
                <div className="flex flex-col items-center flex-1">
                  <div className="w-full bg-emerald-500 rounded-t transition-all hover:bg-emerald-600" style={{ height: '75%' }}></div>
                  <div className="text-[8px] text-emerald-700 mt-1 font-semibold text-center">$27-29k</div>
                </div>
                <div className="flex flex-col items-center flex-1">
                  <div className="w-full bg-blue-400 rounded-t transition-all hover:bg-blue-500" style={{ height: '55%' }}></div>
                  <div className="text-[8px] text-blue-700 mt-1 text-center">$29-31k</div>
                </div>
                <div className="flex flex-col items-center flex-1">
                  <div className="w-full bg-blue-400 rounded-t transition-all hover:bg-blue-500" style={{ height: '45%' }}></div>
                  <div className="text-[8px] text-blue-700 mt-1 text-center">$31-33k</div>
                </div>
                <div className="flex flex-col items-center flex-1">
                  <div className="w-full bg-blue-400 rounded-t transition-all hover:bg-blue-500" style={{ height: '25%' }}></div>
                  <div className="text-[8px] text-blue-700 mt-1 text-center">$33-35k</div>
                </div>
                <div className="flex flex-col items-center flex-1">
                  <div className="w-full bg-blue-400 rounded-t transition-all hover:bg-blue-500" style={{ height: '10%' }}></div>
                  <div className="text-[8px] text-blue-700 mt-1 text-center">$35-37k</div>
                </div>
              </div>
            </div>

            {/* Price vs. Mileage Scatter Plot */}
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="mb-3">
                <div className="text-xs font-semibold text-slate-700 mb-1">Price vs. Mileage Analysis</div>
                <div className="text-[9px] text-slate-500">Correlation analysis of comparable vehicles</div>
              </div>

              {/* Scatter plot */}
              <div className="relative h-36">
                <svg viewBox="0 0 300 140" className="w-full h-full">
                  {/* Grid lines */}
                  <line x1="30" y1="0" x2="30" y2="115" stroke="#cbd5e1" strokeWidth="1" />
                  <line x1="30" y1="115" x2="300" y2="115" stroke="#cbd5e1" strokeWidth="1" />

                  {/* Y-axis labels (Price) */}
                  <text x="5" y="10" fontSize="7" fill="#64748b">$37k</text>
                  <text x="5" y="35" fontSize="7" fill="#64748b">$31k</text>
                  <text x="5" y="60" fontSize="7" fill="#64748b">$25k</text>
                  <text x="5" y="85" fontSize="7" fill="#64748b">$19k</text>
                  <text x="5" y="110" fontSize="7" fill="#64748b">$13k</text>

                  {/* X-axis labels (Mileage) */}
                  <text x="50" y="130" fontSize="7" fill="#64748b">50k</text>
                  <text x="120" y="130" fontSize="7" fill="#64748b">65k</text>
                  <text x="190" y="130" fontSize="7" fill="#64748b">80k</text>
                  <text x="260" y="130" fontSize="7" fill="#64748b">95k</text>

                  {/* Average mileage line (67k mi) */}
                  <line x1="135" y1="0" x2="135" y2="115" stroke="#10b981" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />

                  {/* Data points - Below Market (gray) */}
                  <circle cx="55" cy="75" r="3" fill="#94a3b8" opacity="0.7" />
                  <circle cx="65" cy="80" r="3" fill="#94a3b8" opacity="0.7" />
                  <circle cx="80" cy="72" r="3" fill="#94a3b8" opacity="0.7" />
                  <circle cx="95" cy="85" r="3" fill="#94a3b8" opacity="0.7" />
                  <circle cx="110" cy="78" r="3" fill="#94a3b8" opacity="0.7" />

                  {/* Data points - Market Range (green) */}
                  <circle cx="70" cy="58" r="3" fill="#10b981" opacity="0.8" />
                  <circle cx="85" cy="62" r="3" fill="#10b981" opacity="0.8" />
                  <circle cx="100" cy="55" r="3" fill="#10b981" opacity="0.8" />
                  <circle cx="115" cy="60" r="3" fill="#10b981" opacity="0.8" />
                  <circle cx="125" cy="58" r="3" fill="#10b981" opacity="0.8" />
                  <circle cx="135" cy="57" r="4" fill="#10b981" opacity="1" stroke="#059669" strokeWidth="1.5" />
                  <circle cx="145" cy="59" r="3" fill="#10b981" opacity="0.8" />
                  <circle cx="155" cy="62" r="3" fill="#10b981" opacity="0.8" />
                  <circle cx="165" cy="65" r="3" fill="#10b981" opacity="0.8" />
                  <circle cx="175" cy="63" r="3" fill="#10b981" opacity="0.8" />
                  <circle cx="185" cy="68" r="3" fill="#10b981" opacity="0.8" />
                  <circle cx="120" cy="52" r="3" fill="#10b981" opacity="0.8" />
                  <circle cx="130" cy="54" r="3" fill="#10b981" opacity="0.8" />
                  <circle cx="140" cy="56" r="3" fill="#10b981" opacity="0.8" />
                  <circle cx="150" cy="61" r="3" fill="#10b981" opacity="0.8" />
                  <circle cx="160" cy="64" r="3" fill="#10b981" opacity="0.8" />

                  {/* Data points - Above Market (blue) */}
                  <circle cx="195" cy="45" r="3" fill="#60a5fa" opacity="0.8" />
                  <circle cx="205" cy="40" r="3" fill="#60a5fa" opacity="0.8" />
                  <circle cx="215" cy="38" r="3" fill="#60a5fa" opacity="0.8" />
                  <circle cx="225" cy="42" r="3" fill="#60a5fa" opacity="0.8" />
                  <circle cx="235" cy="35" r="3" fill="#60a5fa" opacity="0.8" />
                  <circle cx="245" cy="32" r="3" fill="#60a5fa" opacity="0.8" />
                  <circle cx="255" cy="28" r="3" fill="#60a5fa" opacity="0.8" />
                  <circle cx="265" cy="25" r="3" fill="#60a5fa" opacity="0.8" />
                  <circle cx="275" cy="22" r="3" fill="#60a5fa" opacity="0.8" />
                  <circle cx="210" cy="48" r="3" fill="#60a5fa" opacity="0.8" />
                  <circle cx="220" cy="43" r="3" fill="#60a5fa" opacity="0.8" />
                  <circle cx="230" cy="38" r="3" fill="#60a5fa" opacity="0.8" />

                  {/* Subject vehicle marker */}
                  <circle cx="135" cy="57" r="4" fill="none" stroke="#ef4444" strokeWidth="2" />
                </svg>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-4 mb-5 text-[8px]">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-slate-300 rounded"></div>
              <span className="text-slate-600">Below Market</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-emerald-500 rounded"></div>
              <span className="text-emerald-700">Market Range</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-400 rounded"></div>
              <span className="text-blue-700">Above Market</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 border-2 border-red-500 rounded"></div>
              <span className="text-red-600">Subject Vehicle</span>
            </div>
          </div>

          {/* Value Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Low Range</div>
              <div className="text-lg font-bold text-slate-900">$20,389</div>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-lg border-2 border-emerald-200">
              <div className="text-xs font-semibold text-emerald-600 uppercase mb-1">
                Fair Market Value
              </div>
              <div className="text-lg font-bold text-emerald-700">$22,654</div>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">High Range</div>
              <div className="text-lg font-bold text-slate-900">$24,919</div>
            </div>
          </div>
        </div>

        {/* Market Comparables Preview */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-blue-50 rounded-full flex items-center justify-center mr-2">
                <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900">Market Comparables</h2>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Showing 10 closest by mileage of 158 listings</div>
              <div className="text-xs text-slate-600 mt-1">
                Avg: $25,341 • Range: $16,495 - $36,981
              </div>
            </div>
          </div>

          {/* Sample Comparables - Table Format */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-[10px] font-semibold text-slate-500 uppercase">Photo</th>
                  <th className="text-left py-2 px-2 text-[10px] font-semibold text-slate-500 uppercase">Vehicle</th>
                  <th className="text-left py-2 px-2 text-[10px] font-semibold text-slate-500 uppercase">Mileage</th>
                  <th className="text-left py-2 px-2 text-[10px] font-semibold text-slate-500 uppercase">Price</th>
                  <th className="text-left py-2 px-2 text-[10px] font-semibold text-slate-500 uppercase">Days</th>
                  <th className="text-left py-2 px-2 text-[10px] font-semibold text-slate-500 uppercase">Dealer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { mileage: '67,095', price: '$23,077', days: '149', dealer: 'Trolley Square Auto' },
                  { mileage: '67,419', price: '$22,963', days: '188', dealer: 'Nucar' },
                  { mileage: '66,622', price: '$23,502', days: '35', dealer: 'Habberstad Bmw' },
                ].map((comp, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-3 px-2">
                      <div className="w-12 h-10 rounded bg-slate-100 flex items-center justify-center">
                        <Car className="h-5 w-5 text-slate-400" />
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="font-semibold text-xs text-slate-900">2021 BMW X3</div>
                      <div className="text-[10px] text-slate-500">30i</div>
                    </td>
                    <td className="py-3 px-2 text-xs text-slate-700 whitespace-nowrap">{comp.mileage} mi</td>
                    <td className="py-3 px-2">
                      <div className="text-sm font-bold text-emerald-600 whitespace-nowrap">{comp.price}</div>
                    </td>
                    <td className="py-3 px-2 text-xs text-slate-500 whitespace-nowrap">{comp.days}</td>
                    <td className="py-3 px-2">
                      <span className="text-xs text-blue-600 hover:text-blue-800 hover:underline">
                        {comp.dealer}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* More indicator */}
          <div className="text-center mt-4 pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-500 font-medium">
              + 7 more comparable vehicles in full report
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
