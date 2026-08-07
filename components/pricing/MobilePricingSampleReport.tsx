'use client'

import { useState } from 'react'
import { FileText, Car, Shield, ChevronDown } from 'lucide-react'

interface BarDatum {
  label: string
  height: number
  color: string
  labelColor: string
  isYourVehicle: boolean
}

const BAR_DATA: BarDatum[] = [
  {
    label: '19-21k',
    height: 22,
    color: 'bg-slate-300',
    labelColor: 'text-slate-600',
    isYourVehicle: false,
  },
  {
    label: '21-23k',
    height: 36,
    color: 'bg-slate-300',
    labelColor: 'text-slate-600',
    isYourVehicle: true,
  },
  {
    label: '23-25k',
    height: 76,
    color: 'bg-emerald-500',
    labelColor: 'text-emerald-700',
    isYourVehicle: false,
  },
  {
    label: '25-27k',
    height: 90,
    color: 'bg-emerald-500',
    labelColor: 'text-emerald-700',
    isYourVehicle: false,
  },
  {
    label: '27-29k',
    height: 67,
    color: 'bg-emerald-500',
    labelColor: 'text-emerald-700',
    isYourVehicle: false,
  },
  {
    label: '29-31k',
    height: 49,
    color: 'bg-blue-400',
    labelColor: 'text-blue-700',
    isYourVehicle: false,
  },
  {
    label: '31-33k',
    height: 31,
    color: 'bg-blue-400',
    labelColor: 'text-blue-700',
    isYourVehicle: false,
  },
  {
    label: '33-35k',
    height: 13,
    color: 'bg-blue-400',
    labelColor: 'text-blue-700',
    isYourVehicle: false,
  },
]

const BELOW_MARKET_POINTS: Array<[number, number]> = [
  [55, 75],
  [65, 80],
  [80, 72],
  [95, 85],
  [110, 78],
]
const MARKET_RANGE_POINTS: Array<[number, number]> = [
  [70, 58],
  [85, 62],
  [100, 55],
  [115, 60],
  [125, 58],
  [145, 59],
  [155, 62],
  [165, 65],
  [175, 63],
  [185, 68],
]
const ABOVE_MARKET_POINTS: Array<[number, number]> = [
  [195, 45],
  [215, 38],
  [235, 35],
  [255, 28],
  [275, 22],
]

const COMPARABLES = [
  { mileage: '67,095 mi', price: '$23,077', days: '149', dealer: 'Trolley Square Auto' },
  { mileage: '67,419 mi', price: '$22,963', days: '188', dealer: 'Nucar' },
  { mileage: '66,622 mi', price: '$23,502', days: '35', dealer: 'Habberstad BMW' },
  { mileage: '61,484 mi', price: '$21,160', days: '48', dealer: 'Schomp Chevrolet Buick GMC' },
  { mileage: '51,799 mi', price: '$22,050', days: '8', dealer: 'Rick Case Mazda' },
  { mileage: '63,265 mi', price: '$23,236', days: '37', dealer: 'Elliot Auto Lounge' },
]

const SPEC_ROWS: Array<[string, string]> = [
  ['Year', '2021'],
  ['Make', 'BMW'],
  ['Mileage', '67,027 mi'],
  ['Model', 'X3'],
  ['Trim', 'xDrive30i SAV'],
  ['Body Style', 'SUV'],
  ['Engine', '2.0L I4'],
  ['Transmission', 'Automatic'],
  ['Drive Type', 'AWD'],
]

interface MobilePricingSampleReportProps {
  onExpand?: () => void
}

export default function MobilePricingSampleReport({ onExpand }: MobilePricingSampleReportProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="relative mb-8 rounded-3xl bg-primary-600 p-2 shadow-xl">
      <div className="absolute -top-3 -right-3 z-20 flex flex-col items-center justify-center rounded-full border-4 border-white bg-primary-600 p-2.5 text-white shadow-2xl">
        <Shield className="h-4 w-4" />
        <div className="mt-0.5 text-center text-[7px] font-bold leading-tight">
          90-DAY
          <br />
          GUARANTEE
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white">
        <div className="p-4">
          {/* Report header — always visible */}
          <div className="mb-5">
            <div className="text-[9px] uppercase tracking-wide text-slate-500">
              TotalLossToolKit Report &rsaquo; ID: B775F192
            </div>
            <div className="mb-1 text-[9px] text-slate-500">Report Date: 12/29/2025</div>
            <h3 className="mb-1 text-2xl font-bold text-slate-900">2021 BMW X3</h3>
            <p className="font-mono text-[11px] text-slate-600">5UXTY5C20M9D79146</p>
          </div>

          {/* Value cards — always visible */}
          <div className="mb-5 grid grid-cols-3 gap-2">
            <div className="rounded-lg border-l-4 border-slate-400 bg-white p-2.5 shadow-sm">
              <div className="mb-1 text-[8px] font-semibold uppercase text-slate-600">
                Low Range
              </div>
              <div className="text-base font-bold text-slate-900">$20,389</div>
              <div className="mt-0.5 text-[8px] text-slate-500">Market floor</div>
            </div>
            <div className="rounded-lg border-l-4 border-emerald-500 bg-white p-2.5 shadow-sm">
              <div className="mb-1 text-[8px] font-semibold uppercase text-emerald-600">
                Market Value
              </div>
              <div className="text-base font-bold text-slate-900">$22,654</div>
              <div className="mt-0.5 text-[8px] font-semibold text-emerald-600">MEDIUM CONF.</div>
            </div>
            <div className="rounded-lg border-l-4 border-blue-500 bg-white p-2.5 shadow-sm">
              <div className="mb-1 text-[8px] font-semibold uppercase text-blue-600">
                High Range
              </div>
              <div className="text-base font-bold text-slate-900">$24,919</div>
              <div className="mt-0.5 text-[8px] text-slate-500">Market ceiling</div>
            </div>
          </div>

          {/* Expand toggle */}
          <button
            type="button"
            onClick={() =>
              setExpanded(prev => {
                const next = !prev
                if (next) {
                  onExpand?.()
                }
                return next
              })
            }
            aria-expanded={expanded}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary-600 bg-primary-50 py-4 shadow-sm transition-transform active:scale-[0.98]"
          >
            <span className="text-sm font-semibold text-primary-700">
              {expanded ? 'Collapse Report' : 'Tap to See Full Report'}
            </span>
            <ChevronDown
              className={`h-5 w-5 text-primary-700 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>

          {expanded && (
            <>
              {/* Vehicle Specifications */}
              <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center">
                  <div className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
                    <FileText className="h-3.5 w-3.5 text-slate-600" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Vehicle Specifications</h4>
                </div>
                <div className="grid grid-cols-3 gap-x-3 gap-y-3">
                  {SPEC_ROWS.map(([label, value]) => (
                    <div key={label}>
                      <div className="mb-0.5 text-[8px] font-semibold uppercase text-slate-500">
                        {label}
                      </div>
                      <div className="text-[11px] font-medium text-slate-900">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Market Distribution & Analysis */}
              <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">
                    Market Distribution &amp; Analysis
                  </h4>
                  <div className="text-[8px] font-semibold uppercase tracking-wide text-emerald-600">
                    MEDIUM CONF.
                  </div>
                </div>
                <p className="mb-3 text-[10px] text-slate-600">
                  Based on 158 live comparable listings from recent market data
                </p>

                {/* Price Distribution bar chart */}
                <div className="mb-3 rounded-lg bg-slate-50 p-3">
                  <div className="mb-2 text-[10px] font-semibold text-slate-700">
                    Price Distribution
                  </div>
                  <div className="flex h-28 items-end justify-center gap-1 px-1">
                    {BAR_DATA.map(bar => (
                      <div
                        key={bar.label}
                        className="relative flex h-full flex-1 flex-col items-center justify-end"
                      >
                        {bar.isYourVehicle && (
                          <div
                            className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center"
                            style={{ bottom: bar.height + 4 }}
                          >
                            <div className="whitespace-nowrap rounded bg-red-500 px-1 py-0.5 text-[6px] font-bold leading-none text-white">
                              YOUR VEHICLE
                            </div>
                            <div
                              className="h-0 w-0"
                              style={{
                                borderLeft: '3px solid transparent',
                                borderRight: '3px solid transparent',
                                borderTop: '4px solid #ef4444',
                              }}
                            />
                          </div>
                        )}
                        <div
                          className={`w-full rounded-t ${bar.color}`}
                          style={{
                            height: bar.height,
                            border: bar.isYourVehicle ? '2px solid #ef4444' : undefined,
                          }}
                        />
                        <div className={`mt-1 text-center text-[7px] ${bar.labelColor}`}>
                          {bar.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Price vs. Mileage scatter plot */}
                <div className="mb-3 rounded-lg bg-slate-50 p-3">
                  <div className="mb-2 text-[10px] font-semibold text-slate-700">
                    Price vs. Mileage Analysis
                  </div>
                  <div className="relative h-28">
                    <svg viewBox="0 0 300 140" className="h-full w-full">
                      <line x1="30" y1="0" x2="30" y2="115" stroke="#cbd5e1" strokeWidth="1" />
                      <line x1="30" y1="115" x2="300" y2="115" stroke="#cbd5e1" strokeWidth="1" />
                      <line
                        x1="135"
                        y1="0"
                        x2="135"
                        y2="115"
                        stroke="#10b981"
                        strokeWidth="1"
                        strokeDasharray="3,3"
                        opacity="0.5"
                      />
                      {BELOW_MARKET_POINTS.map(([cx, cy], i) => (
                        <circle
                          key={`below-${i}`}
                          cx={cx}
                          cy={cy}
                          r="3"
                          fill="#94a3b8"
                          opacity="0.7"
                        />
                      ))}
                      {MARKET_RANGE_POINTS.map(([cx, cy], i) => (
                        <circle
                          key={`market-${i}`}
                          cx={cx}
                          cy={cy}
                          r="3"
                          fill="#10b981"
                          opacity="0.8"
                        />
                      ))}
                      <circle
                        cx="135"
                        cy="57"
                        r="4"
                        fill="#10b981"
                        stroke="#059669"
                        strokeWidth="1.5"
                      />
                      {ABOVE_MARKET_POINTS.map(([cx, cy], i) => (
                        <circle
                          key={`above-${i}`}
                          cx={cx}
                          cy={cy}
                          r="3"
                          fill="#60a5fa"
                          opacity="0.8"
                        />
                      ))}
                      <circle cx="135" cy="57" r="4" fill="none" stroke="#ef4444" strokeWidth="2" />
                      <line x1="135" y1="57" x2="160" y2="30" stroke="#ef4444" strokeWidth="1" />
                      <rect x="158" y="14" width="70" height="16" rx="3" fill="#ef4444" />
                      <text
                        x="193"
                        y="25"
                        fontSize="9"
                        fontWeight="700"
                        fill="white"
                        textAnchor="middle"
                      >
                        YOUR VEHICLE
                      </text>
                    </svg>
                  </div>
                  <div className="mt-2 flex justify-center gap-3 text-[7px]">
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded bg-slate-300" />
                      <span className="text-slate-600">Below</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded bg-emerald-500" />
                      <span className="text-emerald-700">Market</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded bg-blue-400" />
                      <span className="text-blue-700">Above</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded border-2 border-red-500" />
                      <span className="text-red-600">Your Vehicle</span>
                    </div>
                  </div>
                </div>

                {/* Value Summary */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-slate-50 p-2 text-center">
                    <div className="mb-1 text-[8px] font-semibold uppercase text-slate-500">
                      Low
                    </div>
                    <div className="text-sm font-bold text-slate-900">$20,389</div>
                  </div>
                  <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-2 text-center">
                    <div className="mb-1 text-[8px] font-semibold uppercase text-emerald-600">
                      Fair Value
                    </div>
                    <div className="text-sm font-bold text-emerald-700">$22,654</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 text-center">
                    <div className="mb-1 text-[8px] font-semibold uppercase text-slate-500">
                      High
                    </div>
                    <div className="text-sm font-bold text-slate-900">$24,919</div>
                  </div>
                </div>
              </div>

              {/* Market Comparables */}
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-1 flex items-center">
                  <div className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-50">
                    <FileText className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Market Comparables</h4>
                </div>
                <div className="mb-1 text-[9px] text-slate-500">
                  Showing 10 closest by mileage of 158 listings
                </div>
                <div className="mb-3 text-[9px] text-slate-600">
                  Avg: $25,341 &bull; Range: $16,495 - $36,981
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full" style={{ minWidth: 560 }}>
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-1.5 py-1.5 text-left text-[8px] font-semibold uppercase text-slate-500">
                          Photo
                        </th>
                        <th className="px-1.5 py-1.5 text-left text-[8px] font-semibold uppercase text-slate-500">
                          Vehicle
                        </th>
                        <th className="px-1.5 py-1.5 text-left text-[8px] font-semibold uppercase text-slate-500">
                          Mileage
                        </th>
                        <th className="px-1.5 py-1.5 text-left text-[8px] font-semibold uppercase text-slate-500">
                          Price
                        </th>
                        <th className="px-1.5 py-1.5 text-left text-[8px] font-semibold uppercase text-slate-500">
                          Days
                        </th>
                        <th className="px-1.5 py-1.5 text-left text-[8px] font-semibold uppercase text-slate-500">
                          Dealer
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {COMPARABLES.map(comp => (
                        <tr key={comp.dealer}>
                          <td className="px-1.5 py-2">
                            <div className="flex h-8 w-10 items-center justify-center rounded bg-slate-100">
                              <Car className="h-4 w-4 text-slate-400" />
                            </div>
                          </td>
                          <td className="px-1.5 py-2">
                            <div className="text-[10px] font-semibold text-slate-900">
                              2021 BMW X3
                            </div>
                            <div className="text-[8px] text-slate-500">30i</div>
                          </td>
                          <td className="whitespace-nowrap px-1.5 py-2 text-[10px] text-slate-700">
                            {comp.mileage}
                          </td>
                          <td className="px-1.5 py-2">
                            <div className="whitespace-nowrap text-xs font-bold text-emerald-600">
                              {comp.price}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-1.5 py-2 text-[10px] text-slate-500">
                            {comp.days}
                          </td>
                          <td className="px-1.5 py-2">
                            <span className="text-[10px] text-blue-600">{comp.dealer}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3 text-center">
                  <div className="text-[10px] font-medium text-slate-500">
                    + 4 more comparable vehicles in full report
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
