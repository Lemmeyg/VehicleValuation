'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from './ui/Button'
import { ArrowRight, BookOpen, CheckCircle2 } from 'lucide-react'

interface Article {
  slug: string
  title: string
  description: string
  category: string
  readingTime: string
  featured: boolean
}

export default function KnowledgeBase() {
  const [currentArticleIndex, setCurrentArticleIndex] = useState(0)
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchArticles() {
      try {
        const response = await fetch('/api/articles?limit=5')
        const data = await response.json()
        if (data.articles && data.articles.length > 0) {
          setArticles(data.articles)
        }
      } catch (error) {
        console.error('Error fetching articles:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchArticles()
  }, [])

  useEffect(() => {
    if (articles.length === 0) return

    const interval = setInterval(() => {
      setCurrentArticleIndex(prev => (prev + 1) % articles.length)
    }, 6000) // Rotate every 6 seconds
    return () => clearInterval(interval)
  }, [articles.length])

  const currentArticle = articles[currentArticleIndex]
  const otherArticles = articles.filter((_, idx) => idx !== currentArticleIndex).slice(0, 3)

  if (loading) {
    return (
      <section id="knowledge-base" className="py-24 bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-slate-600">Loading articles...</p>
          </div>
        </div>
      </section>
    )
  }

  if (articles.length === 0) {
    return (
      <section id="knowledge-base" className="py-24 bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Vehicle Insights & Resources</h2>
            <p className="text-slate-600 text-lg mb-8">
              Expert guides and resources to help you understand vehicle valuation, market trends,
              and appraisal processes.
            </p>
            <Link href="/knowledge-base">
              <Button variant="primary" size="lg" className="group shadow-lg hover:shadow-xl">
                Browse All Articles{' '}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="knowledge-base" className="py-24 bg-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Vehicle Insights & Resources</h2>
            <p className="text-slate-600 text-lg mb-6">
              Expert guides and resources to help you understand vehicle valuation, market trends,
              and appraisal processes.
            </p>

            {/* Value Props */}
            <div className="space-y-3">
              <div className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                <p className="text-slate-700">
                  <span className="font-semibold">Owners recover 34% more on average</span> with independent appraisal
                </p>
              </div>
              <div className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                <p className="text-slate-700">Articles reveal how owners can get high valuations</p>
              </div>
              <div className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                <p className="text-slate-700">Understand what is the best outcome for you</p>
              </div>
              <div className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                <p className="text-slate-700">Learn appraisal basics that result in better offers</p>
              </div>
              <div className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                <p className="text-slate-700">Spot total loss red flags adjusters hide</p>
              </div>
            </div>
          </div>
          <div className="mt-6 md:mt-0">
            <Link href="/knowledge-base">
              <Button variant="primary" size="lg" className="group shadow-lg hover:shadow-xl">
                Browse All Articles{' '}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
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
                className="inline-block px-3 py-1 text-white text-xs font-bold uppercase tracking-wider rounded-full mb-4 bg-primary-600"
              >
                {currentArticle.category}
              </span>
              <h3 className="text-2xl font-bold text-white mb-3">{currentArticle.title}</h3>
              <p className="text-slate-200 mb-4">{currentArticle.description}</p>
              <div className="flex items-center justify-between">
                <Link href={`/knowledge-base/${currentArticle.slug}`} className="text-white font-medium flex items-center text-sm group-hover:text-primary-300 transition-colors">
                  Read Article <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <span className="text-slate-300 text-xs">{currentArticle.readingTime}</span>
              </div>
            </div>

            {/* Progress Indicators */}
            <div className="absolute top-4 right-4 flex space-x-2 z-20">
              {articles.map((_, idx) => (
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
              <Link
                key={article.slug}
                href={`/knowledge-base/${article.slug}`}
                className="flex gap-6 p-6 rounded-2xl border border-slate-100 hover:border-primary-100 hover:shadow-md transition-all cursor-pointer group bg-white"
              >
                <div className="h-24 w-24 flex-shrink-0 rounded-lg bg-gradient-to-br from-primary-500 to-emerald-600 overflow-hidden flex items-center justify-center">
                  <BookOpen className="h-12 w-12 text-white" />
                </div>
                <div className="flex flex-col justify-center flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="h-3 w-3 text-primary-600" />
                    <span className="text-xs font-semibold text-primary-600 uppercase">
                      {article.category}
                    </span>
                    <span className="text-xs text-slate-400 ml-auto">{article.readingTime}</span>
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-primary-700 transition-colors">
                    {article.title}
                  </h4>
                  <p className="text-slate-500 text-sm line-clamp-2">{article.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
