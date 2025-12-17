/**
 * Knowledge Base Page
 *
 * Displays all knowledge base articles with filtering and search
 */

import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { BookOpen, Clock, Tag } from 'lucide-react'

interface Article {
  id: number
  title: string
  description: string
  category: 'new' | 'popular'
  readTime: string
  tags: string[]
}

const ARTICLES: Article[] = [
  {
    id: 1,
    title: 'Understanding VIN Numbers',
    description:
      "Learn what each digit in your VIN reveals about your vehicle's specifications and history.",
    category: 'popular',
    readTime: '5 min read',
    tags: ['VIN', 'Vehicle Info'],
  },
  {
    id: 2,
    title: "Market Factors Affecting Your Car's Value",
    description:
      'Discover how seasonal demand, regional trends, and supply chain impact vehicle valuations.',
    category: 'new',
    readTime: '7 min read',
    tags: ['Valuation', 'Market Trends'],
  },
  {
    id: 3,
    title: 'How to Prepare for an Appraisal',
    description:
      'Get the best valuation by following these professional appraisal preparation steps.',
    category: 'popular',
    readTime: '4 min read',
    tags: ['Appraisal', 'Tips'],
  },
  {
    id: 4,
    title: 'Total Loss Claims: What You Need to Know',
    description:
      'Navigate the total loss process and ensure you receive fair compensation for your vehicle.',
    category: 'new',
    readTime: '6 min read',
    tags: ['Insurance', 'Total Loss'],
  },
  {
    id: 5,
    title: 'Diminished Value Explained',
    description:
      "Understanding how accidents affect your vehicle's resale value and how to claim diminished value.",
    category: 'popular',
    readTime: '5 min read',
    tags: ['Diminished Value', 'Claims'],
  },
]

export default function KnowledgeBasePage() {
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

          {/* Articles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {ARTICLES.map(article => (
              <div
                key={article.id}
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all cursor-pointer group border border-slate-100 hover:border-primary-200"
              >
                <div className="p-6">
                  {/* Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        article.category === 'new'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-primary-100 text-primary-700'
                      }`}
                    >
                      {article.category}
                    </span>
                    <div className="flex items-center text-slate-500 text-sm">
                      <Clock className="h-4 w-4 mr-1" />
                      {article.readTime}
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
                  <button className="text-primary-600 font-semibold text-sm hover:text-primary-700 flex items-center">
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
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
