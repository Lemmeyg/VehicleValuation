/**
 * Knowledge Base Page
 *
 * Displays all knowledge base articles with filtering and search
 */

import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { BookOpen, Clock, Tag } from 'lucide-react'
import { getAllArticles } from '@/lib/knowledge-base-db'
import Link from 'next/link'

export const metadata = {
  title: 'Knowledge Base | Vehicle Valuation Authority',
  description: 'Expert guides and resources to help you understand vehicle valuation, insurance claims, and your rights',
}

export default async function KnowledgeBasePage() {
  const articles = await getAllArticles()
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">Knowledge Base</h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Expert guides and resources to help you understand vehicle valuation, insurance
              claims, and your rights
            </p>
          </div>

          {/* Disclaimer */}
          <div className="max-w-4xl mx-auto mb-12 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <p className="text-sm text-slate-700 leading-relaxed">
              <strong>Disclaimer:</strong> The information in our knowledge base is for educational purposes only and does not constitute legal, financial, insurance, or professional advice. Vehicle valuations, pricing, VIN data, and insurance strategies are general guides subject to market changes, errors, and individual circumstances—consult licensed attorneys, CPAs, insurance professionals, or certified appraisers before making decisions. Examples are hypothetical and do not guarantee similar results. Visit our{' '}
              <Link href="/service-providers" className="text-primary-600 hover:text-primary-700 underline">
                Service Provider Directory
              </Link>{' '}
              for qualified professionals or see our{' '}
              <Link href="/terms" className="text-primary-600 hover:text-primary-700 underline">
                Terms and Conditions
              </Link>{' '}
              for complete terms.
            </p>
          </div>

          {/* Articles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map(article => (
              <Link
                key={article.slug}
                href={`/knowledge-base/${article.slug}`}
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all cursor-pointer group border border-slate-100 hover:border-primary-200"
              >
                <div className="p-6">
                  {/* Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase bg-primary-100 text-primary-700">
                      {article.category}
                    </span>
                    <div className="flex items-center text-slate-500 text-sm">
                      <Clock className="h-4 w-4 mr-1" />
                      {article.readingTime}
                    </div>
                  </div>

                  {/* Icon */}
                  <div className="mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-emerald-600 rounded-lg flex items-center justify-center">
                      <BookOpen className="h-6 w-6 text-white" />
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-primary-600 transition-colors">
                    {article.title}
                  </h3>

                  {/* Description */}
                  <p className="text-slate-600 mb-4 line-clamp-3">{article.description}</p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {article.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded"
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Read More */}
                  <div className="text-primary-600 font-semibold text-sm hover:text-primary-700 flex items-center">
                    Read Article
                    <svg
                      className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
