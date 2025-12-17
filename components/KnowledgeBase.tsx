'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from './ui/Button'
import { ArrowRight, BookOpen } from 'lucide-react'

interface Article {
  id: number
  title: string
  description: string
  category: 'new' | 'popular'
  readTime: string
}

const ARTICLES: Article[] = [
  {
    id: 1,
    title: 'Understanding VIN Numbers',
    description:
      "Learn what each digit in your VIN reveals about your vehicle's specifications and history.",
    category: 'popular',
    readTime: '5 min read',
  },
  {
    id: 2,
    title: "Market Factors Affecting Your Car's Value",
    description:
      'Discover how seasonal demand, regional trends, and supply chain impact vehicle valuations.',
    category: 'new',
    readTime: '7 min read',
  },
  {
    id: 3,
    title: 'How to Prepare for an Appraisal',
    description:
      'Get the best valuation by following these professional appraisal preparation steps.',
    category: 'popular',
    readTime: '4 min read',
  },
  {
    id: 4,
    title: 'Total Loss Claims: What You Need to Know',
    description:
      'Navigate the total loss process and ensure you receive fair compensation for your vehicle.',
    category: 'new',
    readTime: '6 min read',
  },
  {
    id: 5,
    title: 'Diminished Value Explained',
    description:
      "Understanding how accidents affect your vehicle's resale value and how to claim diminished value.",
    category: 'popular',
    readTime: '5 min read',
  },
]

export default function KnowledgeBase() {
  const [currentArticleIndex, setCurrentArticleIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentArticleIndex(prev => (prev + 1) % ARTICLES.length)
    }, 6000) // Rotate every 6 seconds
    return () => clearInterval(interval)
  }, [])

  const currentArticle = ARTICLES[currentArticleIndex]
  const otherArticles = ARTICLES.filter((_, idx) => idx !== currentArticleIndex).slice(0, 3)

  return (
    <section id="knowledge-base" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Vehicle Insights & Resources</h2>
            <p className="text-slate-600 text-lg">
              Expert guides and resources to help you understand vehicle valuation, market trends,
              and appraisal processes.
            </p>
          </div>
          <div className="mt-6 md:mt-0">
            <Link href="/knowledge-base">
              <Button variant="outline" className="group">
                Link to KB page{' '}
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Featured Article - Rotating */}
          <div className="relative rounded-2xl overflow-hidden group cursor-pointer h-full min-h-[400px] bg-gradient-to-br from-primary-600 to-emerald-700">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

            {/* Decorative pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-10 right-10 w-32 h-32 border-4 border-white rounded-full" />
              <div className="absolute bottom-10 left-10 w-24 h-24 border-4 border-white rounded-full" />
            </div>

            <div className="absolute bottom-0 left-0 p-8 relative z-10 transition-all duration-500">
              <span
                className={`inline-block px-3 py-1 text-white text-xs font-bold uppercase tracking-wider rounded-full mb-4 ${
                  currentArticle.category === 'new' ? 'bg-emerald-600' : 'bg-primary-600'
                }`}
              >
                {currentArticle.category === 'new' ? 'New Article' : 'Popular'}
              </span>
              <h3 className="text-2xl font-bold text-white mb-3">{currentArticle.title}</h3>
              <p className="text-slate-200 mb-4">{currentArticle.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-white font-medium flex items-center text-sm group-hover:text-primary-300 transition-colors">
                  Read Article <ArrowRight className="ml-2 h-4 w-4" />
                </span>
                <span className="text-slate-300 text-xs">{currentArticle.readTime}</span>
              </div>
            </div>

            {/* Progress Indicators */}
            <div className="absolute top-4 right-4 flex space-x-2 z-20">
              {ARTICLES.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    idx === currentArticleIndex ? 'w-8 bg-white' : 'w-2 bg-white/40'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* List of other articles */}
          <div className="flex flex-col space-y-4">
            {otherArticles.map(article => (
              <div
                key={article.id}
                className="flex gap-6 p-6 rounded-2xl border border-slate-100 hover:border-primary-100 hover:shadow-md transition-all cursor-pointer group bg-white"
              >
                <div className="h-24 w-24 flex-shrink-0 rounded-lg bg-gradient-to-br from-primary-500 to-emerald-600 overflow-hidden flex items-center justify-center">
                  <BookOpen className="h-12 w-12 text-white" />
                </div>
                <div className="flex flex-col justify-center flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="h-3 w-3 text-primary-600" />
                    <span className="text-xs font-semibold text-primary-600 uppercase">
                      {article.category === 'new' ? 'New' : 'Popular'}
                    </span>
                    <span className="text-xs text-slate-400 ml-auto">{article.readTime}</span>
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-primary-700 transition-colors">
                    {article.title}
                  </h4>
                  <p className="text-slate-500 text-sm line-clamp-2">{article.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
