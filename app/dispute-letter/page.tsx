import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import DisputeLetterForm from '@/components/DisputeLetterForm'
import { FileText, Scale, Search } from 'lucide-react'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.totallosstoolkit.com'

export const metadata = {
  title: 'Free Total Loss Dispute Letter Template | TotalLossToolkit.com',
  description:
    "Download a free, professionally written dispute letter template to challenge your insurance company's total loss valuation. Disputes the figure, challenges the methodology, and requests the comps.",
  alternates: {
    canonical: `${siteUrl}/dispute-letter`,
  },
  openGraph: {
    title: 'Free Total Loss Dispute Letter Template',
    description:
      'A free 3-part dispute letter that contests the valuation, challenges their methodology, and demands the comps they used.',
    type: 'website',
    url: `${siteUrl}/dispute-letter`,
    siteName: 'TotalLossToolKit.com',
  },
}

export default function DisputeLetterPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <span className="inline-block px-3 py-1 text-sm font-semibold text-primary-600 bg-primary-50 rounded-full mb-4">
              Free Download
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 leading-tight">
              The Dispute Letter That Gets Insurance Companies to Negotiate
            </h1>
            <p className="text-xl text-slate-600">
              A professionally written 3-part letter: dispute the valuation figure, challenge their
              methodology, and demand the comparable vehicles they used. Download free — no account
              needed.
            </p>
          </div>

          <ul className="mb-8 space-y-4">
            <li className="flex items-start gap-3">
              <Scale className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
              <span className="text-slate-700">
                Formally contests the carrier&apos;s valuation with your own market comps
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Search className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
              <span className="text-slate-700">
                Demands a written explanation of their methodology and data source
              </span>
            </li>
            <li className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
              <span className="text-slate-700">
                Requests every comparable vehicle used — the part of their valuation most likely to
                reveal errors
              </span>
            </li>
          </ul>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 mb-6">
            <DisputeLetterForm />
          </div>

          <p className="text-center text-sm text-slate-500 italic">
            Used by vehicle owners across the US to recover thousands in underpaid settlements.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
