'use client'

import { AlertTriangle, TrendingUp, Clock } from 'lucide-react'

/**
 * Problem Statement Section
 *
 * Explains the core problem: insurance companies lowball claims.
 * Visually impactful design with statistics and icons.
 */

export default function ProblemStatement() {
  return (
    <section className="relative py-24 bg-gradient-to-br from-slate-50 via-white to-primary-50/30 overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-100/40 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-100/30 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 px-4 py-2 rounded-full mb-4">
            <span className="text-sm font-semibold">The Problem</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Remember, Insurance Companies Don't Work For You
          </h2>
        </div>

        {/* Main Content Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-xl border border-slate-200">
          <p className="text-center text-xl md:text-2xl text-slate-700 leading-relaxed font-medium max-w-4xl mx-auto">
            Insurers employ streamlined valuations aligned with their operational priorities—often undervaluing claims by <span className="text-primary-600 font-bold">over 27%</span>. Securing an independent appraisal beforehand not only elevates your average settlement amount but also reduces resolution times by <span className="text-primary-600 font-bold">20-30%</span>, expediting access to your fair compensation efficiently.
          </p>
        </div>
      </div>
    </section>
  )
}
