import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import CompsCheckForm from '@/components/CompsCheckForm'
import { getCompsCheckCopy } from '@/lib/audit-submissions/page-copy'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.totallosstoolkit.com'

export const metadata = {
  title: 'Free Insurer Report Check | TotalLossToolkit.com',
  description:
    "Upload your insurer's total-loss valuation report or comps list and we'll check it for pricing adjustments courts have ruled against — free, no obligation.",
  alternates: {
    canonical: `${siteUrl}/comps-check`,
  },
  robots: {
    index: false,
    follow: false,
  },
}

const HOW_IT_WORKS = [
  "Upload your insurer's valuation report. It takes about two minutes.",
  'Our team checks it against what insurers have been challenged on.',
  'You get a written answer by email within 48 hours, whether we find something or not.',
]

// The wording comes from a PostHog flag payload ("copy slots", workstream 7), so an
// approved change goes live without a deploy. Re-read at most once a minute.
export const revalidate = 60

export default async function CompsCheckPage() {
  const copy = await getCompsCheckCopy()

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <span className="inline-block px-3 py-1 text-sm font-semibold text-primary-600 bg-primary-50 rounded-full mb-4">
              Beta — a new, free service we&apos;re piloting
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 leading-tight">
              {copy.headline}
            </h1>
            <p className="text-xl text-slate-600">{copy.subheadline}</p>
            {copy.trustLine && (
              <p className="mt-3 text-base font-medium text-slate-700">{copy.trustLine}</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 mb-6">
            <CompsCheckForm pageVariant={copy.version} submitLabel={copy.submitLabel} />
          </div>

          <ol className="grid gap-3 sm:grid-cols-3 text-left" aria-label="How it works">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={step} className="flex gap-3 rounded-xl border border-slate-200 p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700">
                  {i + 1}
                </span>
                <span className="text-sm text-slate-700">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </main>
      <Footer />
    </div>
  )
}
