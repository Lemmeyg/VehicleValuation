/**
 * Vehicle Valuation Report - Action Plan / Next Steps Page
 *
 * Provides users with a comprehensive checklist for responding to insurance offers
 * and maximizing their settlement. Serves as a lead generator for the services directory.
 */

import { getUser } from '@/lib/db/auth'
import { createServerSupabaseClient } from '@/lib/db/supabase'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle,
  Clock,
  FileText,
  Camera,
  DollarSign,
  Phone,
  AlertCircle,
  Scale,
  TrendingUp,
  Download,
  ArrowLeft,
} from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ActionPlanPage({ params }: PageProps) {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }

  const { id } = await params
  const supabase = await createServerSupabaseClient()

  // Fetch the report
  const { data: report, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !report) {
    redirect('/dashboard')
  }

  const autodevData = report.autodev_vin_data as any
  const vehicleName = `${autodevData?.vehicle?.year || ''} ${autodevData?.make || ''} ${autodevData?.model || ''}`.trim()

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header with Back Button */}
        <div className="mb-8">
          <Link
            href={`/reports/${id}/view`}
            className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Report
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Your Next Steps Guide</h1>
              <p className="text-slate-600 mt-2">{vehicleName}</p>
            </div>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Print Checklist
            </button>
          </div>
        </div>

        {/* Introduction Box */}
        <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8">
          <div className="flex items-start">
            <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-3">Action Plan</h2>
              <p className="text-slate-700 mb-4">
                You now have the market data you need. This checklist guides you through responding to the insurance offer and building your strongest case for fair compensation.
              </p>
              <p className="text-slate-600 text-sm">
                Some steps are straightforward—others may benefit from professional assistance. Focus on completing the actions that match your comfort level and timeline.
              </p>
            </div>
          </div>
        </div>

        {/* Step 1: Immediate Actions */}
        <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8">
          <div className="flex items-center mb-6">
            <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-xl font-bold text-red-600">1</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Immediate Actions</h3>
              <div className="flex items-center text-sm text-slate-600 mt-1">
                <Clock className="h-4 w-4 mr-1" />
                Within 24-48 hours
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Action Item 1 */}
            <div className="border-l-4 border-emerald-500 pl-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-slate-900">Review your insurance policy</h4>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Easy</span>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                Read the "Total Loss" or "Actual Cash Value" section. Understand your coverage, deductibles, and any appraisal rights.
              </p>
              <div className="bg-slate-50 border-l-2 border-slate-300 pl-3 py-2 text-sm text-slate-600 italic">
                Knowing your policy rights prevents adjusters from using tactics that contradict your coverage.
              </div>
            </div>

            {/* Action Item 2 */}
            <div className="border-l-4 border-emerald-500 pl-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-slate-900">Do NOT accept the first offer immediately</h4>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Easy</span>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                First offers average 15-25% below fair market value. Take time to review this report and prepare your response.
              </p>
              <div className="bg-slate-50 border-l-2 border-slate-300 pl-3 py-2 text-sm text-slate-600 italic">
                Don't let "offer expires in 48 hours" pressure you—this is a common negotiation tactic.
              </div>
            </div>

            {/* Action Item 3 */}
            <div className="border-l-4 border-emerald-500 pl-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-slate-900">Calculate your financial position</h4>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Easy</span>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                Determine: outstanding loan balance, insurance offer amount, whether you have gap insurance, estimated settlement after payoff.
              </p>
              <div className="bg-slate-50 border-l-2 border-slate-300 pl-3 py-2 text-sm text-slate-600 italic">
                Understanding if you're upside-down on your loan changes your negotiation strategy.
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Gather Evidence */}
        <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8">
          <div className="flex items-center mb-6">
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-xl font-bold text-blue-600">2</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Gather Evidence</h3>
              <div className="flex items-center text-sm text-slate-600 mt-1">
                <Clock className="h-4 w-4 mr-1" />
                Days 2-5
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Action Item 1 */}
            <div className="border-l-4 border-blue-500 pl-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-slate-900">Collect maintenance and service records</h4>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Easy</span>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                Gather receipts for oil changes, tire replacements, brake service, and major repairs. Recent maintenance is especially valuable.
              </p>
              <div className="bg-slate-50 border-l-2 border-slate-300 pl-3 py-2 text-sm text-slate-600 italic">
                Documented maintenance can add 5-10% to your settlement by proving excellent care.
              </div>
            </div>

            {/* Action Item 2 */}
            <div className="border-l-4 border-blue-500 pl-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-slate-900">Take comprehensive photos (if accessible)</h4>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Easy</span>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                Photograph: all exterior angles, interior condition, odometer, engine bay, trunk, special features, recent upgrades.
              </p>
              <div className="bg-slate-50 border-l-2 border-slate-300 pl-3 py-2 text-sm text-slate-600 italic">
                Photos counter any "excessive wear" deductions from the adjuster.
              </div>
            </div>

            {/* Action Item 3 */}
            <div className="border-l-4 border-blue-500 pl-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-slate-900">Request the adjuster's valuation breakdown</h4>
                <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded">Medium</span>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                Ask for: comparables they used, their methodology, condition deductions applied, written explanation of their offer.
              </p>
              <div className="bg-slate-50 border-l-2 border-slate-300 pl-3 py-2 text-sm text-slate-600 italic">
                You can't negotiate effectively without knowing how they calculated their number.
              </div>
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">Not sure what to ask for?</p>
                    <p className="text-sm text-blue-700 mb-2">Professionals know exactly how to request this information</p>
                    <Link href="/services" className="text-sm font-semibold text-blue-600 hover:text-blue-800 underline">
                      Get Help →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Build Your Counter-Offer */}
        <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8">
          <div className="flex items-center mb-6">
            <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-xl font-bold text-purple-600">3</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Build Your Counter-Offer</h3>
              <div className="flex items-center text-sm text-slate-600 mt-1">
                <Clock className="h-4 w-4 mr-1" />
                Days 5-7
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Action Item 1 */}
            <div className="border-l-4 border-purple-500 pl-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-slate-900">Analyze adjuster's comparables vs. yours</h4>
                <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">Hard</span>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                Look for wrong trim levels, excessive mileage differences, geographic mismatches, or outdated listings. Document discrepancies.
              </p>
              <div className="bg-slate-50 border-l-2 border-slate-300 pl-3 py-2 text-sm text-slate-600 italic">
                Exposing flawed comparables is your strongest negotiation leverage.
              </div>
              <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-start">
                  <TrendingUp className="h-5 w-5 text-purple-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-purple-900 mb-1">This is where most people struggle</p>
                    <p className="text-sm text-purple-700 mb-2">Experts identify weak comparables and build bulletproof counter-arguments</p>
                    <Link href="/services" className="text-sm font-semibold text-purple-600 hover:text-purple-800 underline">
                      Find Expert →
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Item 2 */}
            <div className="border-l-4 border-purple-500 pl-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-slate-900">Draft professional counter-offer letter</h4>
                <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">Hard</span>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                Write formal letter that presents your data-backed counter-offer with this report and supporting evidence.
              </p>
              <div className="bg-slate-50 border-l-2 border-slate-300 pl-3 py-2 text-sm text-slate-600 italic">
                The tone and structure can make or break your negotiation.
              </div>
              <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-start">
                  <FileText className="h-5 w-5 text-purple-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-purple-900 mb-1">Professional templates get better results</p>
                    <p className="text-sm text-purple-700 mb-2">Proven templates that adjusters respect</p>
                    <Link href="/services" className="text-sm font-semibold text-purple-600 hover:text-purple-800 underline">
                      Get Templates →
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Item 3 */}
            <div className="border-l-4 border-purple-500 pl-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-slate-900">Determine your target settlement numbers</h4>
                <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded">Medium</span>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                Set: ideal number (75th percentile), realistic target (median), walk-away minimum based on your condition.
              </p>
              <div className="bg-slate-50 border-l-2 border-slate-300 pl-3 py-2 text-sm text-slate-600 italic">
                Going into negotiation without clear targets leads to accepting less than you should.
              </div>
            </div>
          </div>
        </div>

        {/* Step 4: Negotiate Settlement */}
        <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8">
          <div className="flex items-center mb-6">
            <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-xl font-bold text-emerald-600">4</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Negotiate Settlement</h3>
              <div className="flex items-center text-sm text-slate-600 mt-1">
                <Clock className="h-4 w-4 mr-1" />
                Days 7-21
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Action Item 1 */}
            <div className="border-l-4 border-emerald-500 pl-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-slate-900">Submit counter-offer package</h4>
                <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded">Medium</span>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                Send via email AND certified mail: counter-offer letter, this report, maintenance records, photos, documentation.
              </p>
              <div className="bg-slate-50 border-l-2 border-slate-300 pl-3 py-2 text-sm text-slate-600 italic">
                Email for speed, certified mail for proof of delivery if you need to escalate.
              </div>
            </div>

            {/* Action Item 2 */}
            <div className="border-l-4 border-emerald-500 pl-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-slate-900">Conduct phone negotiation with adjuster</h4>
                <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">Hard</span>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                Remain calm and professional, reference specific data, ask about their methodology, resist pressure tactics, take notes.
              </p>
              <div className="bg-slate-50 border-l-2 border-slate-300 pl-3 py-2 text-sm text-slate-600 italic">
                Adjusters are trained negotiators—this is their full-time job.
              </div>
              <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="flex items-start">
                  <Phone className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-900 mb-1">This conversation determines your settlement</p>
                    <p className="text-sm text-emerald-700 mb-2">Professional negotiators handle these calls daily</p>
                    <Link href="/services" className="text-sm font-semibold text-emerald-600 hover:text-emerald-800 underline">
                      Hire Pro →
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Item 3 */}
            <div className="border-l-4 border-emerald-500 pl-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-slate-900">Document all communication</h4>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Easy</span>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                Log: date/time, adjuster's name, discussion points, offers made, promises, next steps. Essential if you need to escalate.
              </p>
            </div>
          </div>
        </div>

        {/* Step 5: Escalate if Necessary */}
        <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8">
          <div className="flex items-center mb-6">
            <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-xl font-bold text-amber-600">5</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Escalate if Necessary</h3>
              <div className="flex items-center text-sm text-slate-600 mt-1">
                <AlertCircle className="h-4 w-4 mr-1" />
                If settlement stalls
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Action Item 1 */}
            <div className="border-l-4 border-amber-500 pl-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-slate-900">Request supervisor/manager review</h4>
                <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded">Medium</span>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                Formally request supervisor review of your case. Managers often have more authority to approve higher settlements.
              </p>
            </div>

            {/* Action Item 2 */}
            <div className="border-l-4 border-amber-500 pl-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-slate-900">Consider independent appraisal (gap &gt;$2,000)</h4>
                <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">Hard</span>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                Hire certified independent appraiser. Cost: $200-$500. Third-party appraisals carry significant weight.
              </p>
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start">
                  <FileText className="h-5 w-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 mb-1">Finding the right appraiser matters</p>
                    <p className="text-sm text-amber-700 mb-2">We've vetted the best qualified for insurance disputes</p>
                    <Link href="/services" className="text-sm font-semibold text-amber-600 hover:text-amber-800 underline">
                      Find Appraisers →
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Item 3 */}
            <div className="border-l-4 border-amber-500 pl-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-slate-900">Consult attorney (if gap &gt;$5,000)</h4>
                <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">Hard</span>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                For large disputes or bad faith suspicions, consult insurance claims attorney. Many offer free consultations.
              </p>
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start">
                  <Scale className="h-5 w-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 mb-1">Free consultations available</p>
                    <p className="text-sm text-amber-700 mb-2">Insurance attorneys offer no-cost case reviews</p>
                    <Link href="/services" className="text-sm font-semibold text-amber-600 hover:text-amber-800 underline">
                      Find Attorney →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Assistance CTA */}
        <div className="bg-gradient-to-r from-emerald-600 to-blue-600 rounded-lg p-8 mb-8 text-white">
          <h2 className="text-2xl font-bold mb-4">Professional Assistance Available</h2>
          <p className="text-emerald-50 mb-6">
            Most vehicle owners leave $2,000-$5,000 on the table because they lack the time, expertise, or confidence to negotiate effectively. Our Professional Services Directory connects you with certified experts who handle total loss negotiations daily.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <FileText className="h-8 w-8 mb-3" />
              <h3 className="font-semibold mb-2">Certified Appraisers</h3>
              <p className="text-sm text-emerald-50">Independent valuations that carry weight with insurance companies</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <DollarSign className="h-8 w-8 mb-3" />
              <h3 className="font-semibold mb-2">Claim Negotiators</h3>
              <p className="text-sm text-emerald-50">Handle adjuster calls and maximize your settlement</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <Scale className="h-8 w-8 mb-3" />
              <h3 className="font-semibold mb-2">Insurance Attorneys</h3>
              <p className="text-sm text-emerald-50">Legal experts for complex disputes and bad faith claims</p>
            </div>
          </div>

          <Link
            href="/services"
            className="inline-flex items-center px-6 py-3 bg-white text-emerald-600 rounded-lg font-semibold hover:bg-emerald-50 transition-colors"
          >
            Browse Professional Services Directory
            <ArrowLeft className="h-5 w-5 ml-2 rotate-180" />
          </Link>
          <p className="text-sm text-emerald-50 mt-3">
            All professionals are vetted, licensed, and experienced in total loss negotiations
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-slate-500">
          <p>© 2024 ELITE VALUATION SERVICES</p>
          <div className="flex justify-center space-x-4 mt-2">
            <Link href="/terms" className="hover:text-slate-700">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-slate-700">Privacy Policy</Link>
            <Link href="/contact" className="hover:text-slate-700">Contact Support</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
