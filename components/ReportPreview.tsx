'use client'

/**
 * Report Preview Component
 *
 * Visual representation of the Elite Vehicle Valuation Report
 * Displays a sample report without embedding PDF
 */

export default function ReportPreview() {
  return (
    <div
      className="bg-white rounded-lg shadow-lg overflow-hidden"
      style={{ height: '800px', overflowY: 'auto' }}
    >
      {/* Page 1 - Main Report */}
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-xs text-slate-500 mb-1">
              VEHICLE VALUATION REPORT &gt; ID: A413F440
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-1">2020 Honda Civic</h1>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <span className="font-mono">1HGCM82633A123456</span>
              <span>Report Date: 12/19/2024</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm border border-slate-300 rounded hover:bg-slate-50">
              Print
            </button>
            <button className="px-4 py-2 text-sm bg-emerald-500 text-white rounded hover:bg-emerald-600">
              Share
            </button>
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="border-l-4 border-emerald-500 pl-4 py-3">
            <div className="text-xs text-emerald-600 font-semibold mb-1">ESTIMATED VALUE</div>
            <div className="text-3xl font-bold text-slate-900">$18,500</div>
            <div className="text-xs text-slate-500 mt-1">HIGH RELIABILITY</div>
          </div>
          <div className="border-l-4 border-amber-500 pl-4 py-3">
            <div className="text-xs text-amber-600 font-semibold mb-1">HISTORY EVENTS</div>
            <div className="text-3xl font-bold text-slate-900">1</div>
            <div className="text-xs text-slate-500 mt-1">Requires verification review</div>
          </div>
          <div className="border-l-4 border-blue-500 pl-4 py-3">
            <div className="text-xs text-blue-600 font-semibold mb-1">AI PREDICTION</div>
            <div className="text-3xl font-bold text-slate-900">$22,400</div>
            <div className="text-xs text-slate-500 mt-1">Machine learning market model</div>
          </div>
        </div>

        {/* Vehicle Specifications */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
              <span className="text-xs text-slate-600">i</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Vehicle Specifications</h2>
          </div>

          <div className="grid grid-cols-5 gap-4 mb-4">
            <div>
              <div className="text-xs text-slate-500 mb-1">YEAR</div>
              <div className="font-semibold text-slate-900">2020</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">MAKE</div>
              <div className="font-semibold text-slate-900">Honda</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">MODEL</div>
              <div className="font-semibold text-slate-900">Civic</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">TRIM</div>
              <div className="font-semibold text-slate-900">EX</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">BODY STYLE</div>
              <div className="font-semibold text-slate-900">Sedan</div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-4 mb-6">
            <div>
              <div className="text-xs text-slate-500 mb-1">ENGINE</div>
              <div className="font-semibold text-slate-900">2.0L I4</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">TRANSMISSION</div>
              <div className="font-semibold text-slate-900">CVT Automatic</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">DRIVE TYPE</div>
              <div className="font-semibold text-slate-900">FWD</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">FUEL TYPE</div>
              <div className="font-semibold text-slate-900">Gasoline</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">COLOR</div>
              <div className="font-semibold text-slate-900">Modern Steel Metallic</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-8">
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 text-sm">📊</span>
              </div>
              <div>
                <div className="text-xs text-slate-500">Odometer</div>
                <div className="font-bold text-slate-900">50,000 mi</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <span className="text-emerald-600 text-sm">✓</span>
              </div>
              <div>
                <div className="text-xs text-slate-500">Title Status</div>
                <div className="font-bold text-emerald-600">Clean</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                <span className="text-slate-600 text-sm">👥</span>
              </div>
              <div>
                <div className="text-xs text-slate-500">Owners</div>
                <div className="font-bold text-slate-900">2</div>
              </div>
            </div>
          </div>
        </div>

        {/* Market Distribution */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-900">Market Distribution</h2>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
              CONFIDENCE: HIGH
            </span>
          </div>
          <div className="text-sm text-slate-600 mb-4">Based on 127 comparable data points</div>

          {/* Distribution Chart Visualization */}
          <div className="relative h-32 mb-6">
            <svg viewBox="0 0 600 120" className="w-full h-full">
              {/* Bell curve */}
              <path
                d="M 50 100 Q 150 20, 300 10 T 550 100"
                fill="rgba(16, 185, 129, 0.1)"
                stroke="rgb(16, 185, 129)"
                strokeWidth="3"
              />
              {/* Center line */}
              <line
                x1="300"
                y1="10"
                x2="300"
                y2="120"
                stroke="rgb(16, 185, 129)"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
            </svg>
            <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-slate-500 px-8">
              <span>$17k</span>
              <span>$19k</span>
              <span>$22k</span>
              <span>$23k</span>
            </div>
          </div>

          {/* Value Ranges */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">LOW RANGE</div>
              <div className="text-2xl font-bold text-slate-900">$15,725</div>
            </div>
            <div className="text-center p-4 bg-emerald-50 rounded-lg border-2 border-emerald-500">
              <div className="text-xs text-emerald-600 font-semibold mb-1">FAIR MARKET VALUE</div>
              <div className="text-2xl font-bold text-emerald-600">$18,500</div>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">HIGH RANGE</div>
              <div className="text-2xl font-bold text-slate-900">$21,275</div>
            </div>
          </div>
        </div>

        {/* Accident History */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-red-600 text-sm">⚠</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Reported Accident History</h2>
          </div>

          <div className="border-l-4 border-red-500 pl-4 py-2">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">2023-06-15</span>
              <span className="text-sm font-semibold text-red-600">Moderate Impact</span>
            </div>
          </div>

          <div className="mt-6 bg-slate-50 rounded-lg p-6">
            <h3 className="font-semibold text-slate-900 mb-3">Accident Event</h3>
            <p className="text-sm text-slate-700 mb-4">
              Front-end collision. Damage to bumper, hood, and right fender. Structural integrity
              verified post-repair.
            </p>

            <div className="bg-white rounded border border-slate-200 p-4">
              <div className="text-xs font-semibold text-slate-500 mb-3">EVENT PARAMETERS</div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Location:</span>
                  <span className="font-semibold text-slate-900">Los Angeles, CA</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Est. Damage:</span>
                  <span className="font-semibold text-slate-900">$4,500</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Repaired:</span>
                  <span className="font-semibold text-emerald-600">Verified</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page 2 - Market Comparables */}
        <div className="border-t-2 border-slate-200 pt-8 mt-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
              <span className="text-slate-600 text-sm">📊</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Market Comparables</h2>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">
                    VEHICLE DETAILS
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">
                    MILEAGE
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">
                    MARKET PRICE
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">
                    LOCATION
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">
                    SOURCE
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  {
                    trim: 'EX',
                    mileage: '42,000 mi',
                    price: '$19,500',
                    location: 'Los Angeles, CA',
                    source: 'CARS.COM',
                  },
                  {
                    trim: 'LX',
                    mileage: '55,000 mi',
                    price: '$17,200',
                    location: 'Santa Monica, CA',
                    source: 'CARGURUS',
                  },
                  {
                    trim: 'EX',
                    mileage: '48,000 mi',
                    price: '$18,900',
                    location: 'Long Beach, CA',
                    source: 'AUTOTRADER',
                  },
                  {
                    trim: 'EX',
                    mileage: '38,000 mi',
                    price: '$22,800',
                    location: 'Los Angeles, CA',
                    source: 'MARKETCHECK',
                  },
                  {
                    trim: 'EX-L',
                    mileage: '41,000 mi',
                    price: '$21,500',
                    location: 'Pasadena, CA',
                    source: 'MARKETCHECK',
                  },
                  {
                    trim: 'EX',
                    mileage: '52,000 mi',
                    price: '$18,200',
                    location: 'Irvine, CA',
                    source: 'MARKETCHECK',
                  },
                  {
                    trim: 'Sport',
                    mileage: '45,000 mi',
                    price: '$19,900',
                    location: 'Torrance, CA',
                    source: 'MARKETCHECK',
                  },
                  {
                    trim: 'EX',
                    mileage: '33,000 mi',
                    price: '$23,100',
                    location: 'Burbank, CA',
                    source: 'MARKETCHECK',
                  },
                ].map((comp, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">2020 Honda Civic</div>
                      <div className="text-xs text-slate-500">{comp.trim}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{comp.mileage}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-600">{comp.price}</td>
                    <td className="px-4 py-3 text-slate-700">{comp.location}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-100 px-2 py-1 rounded">{comp.source}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Collision Decision Support */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 text-sm">📋</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Collision Decision Support</h2>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-slate-700 mb-2">Your Loan Balance ($)</label>
              <div className="bg-white border border-slate-300 rounded px-4 py-2 text-slate-900 font-mono">
                15000
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-700 mb-2">Repair Estimate ($)</label>
              <div className="bg-white border border-slate-300 rounded px-4 py-2 text-slate-900 font-mono">
                5000
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-lg p-6 border-l-4 border-emerald-500">
            <div className="text-xs font-semibold text-emerald-600 mb-3">ANALYSIS RESULT</div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-700">Current Market Value:</span>
                <span className="font-bold text-slate-900">$18,500</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-700">Equity Position:</span>
                <span className="font-bold text-emerald-600">$3,500</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-700">Est. Total Loss Threshold:</span>
                <span className="font-bold text-slate-900">$12,950</span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-emerald-50 rounded text-sm">
              <span className="text-emerald-600 font-semibold">✅</span> Repair cost is below the
              typical threshold. The vehicle is likely economically repairable.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
