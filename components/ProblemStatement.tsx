'use client'

/**
 * Problem Statement Section
 *
 * Explains the core problem: insurance companies lowball claims.
 * Single paragraph format with contrasting background.
 */

export default function ProblemStatement() {
  return (
    <section className="py-16 bg-white border-y border-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-lg text-slate-700 leading-relaxed">
          Insurers use valuations that suit their operational priorities and financial goals,
          meeting their needs, not yours. Securing an independent appraisal beforehand not only
          increases your average settlement amount but also reduces resolution times by 20-30%,
          giving you access to your fair compensation sooner.
        </p>
      </div>
    </section>
  )
}
