'use client'

import Link from 'next/link'
import { trackEvent } from '@/lib/analytics/events'

interface ArticleCTAProps {
  articleSlug: string
}

export function ArticleCTA({ articleSlug }: ArticleCTAProps) {
  function handleClick() {
    trackEvent('kb_article_cta_clicked', {
      article_slug: articleSlug,
    })
  }

  return (
    <div className="mt-12 rounded-2xl bg-primary-600 px-8 py-10 text-center">
      <h2 className="text-2xl font-bold text-white">
        Ready to challenge your insurer&apos;s valuation?
      </h2>
      <p className="mt-3 text-primary-100">
        Get an independent vehicle valuation report backed by real market data — and the evidence
        you need to fight back.
      </p>
      <Link
        href="/#hero-form"
        onClick={handleClick}
        className="mt-6 inline-block rounded-lg bg-white px-8 py-3 text-base font-semibold text-primary-700 shadow hover:bg-primary-50 transition-colors"
      >
        Get My Valuation Report
      </Link>
    </div>
  )
}
