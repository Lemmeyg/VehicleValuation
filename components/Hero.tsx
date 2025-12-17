'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from './ui/Button'
import { ArrowRight, BookOpen, CheckCircle2 } from 'lucide-react'
import RateLimitModal from './RateLimitModal'

interface Article {
  id: number
  title: string
  excerpt: string
  category: string
  readTime: string
}

const TOP_ARTICLES: Article[] = [
  {
    id: 1,
    title: "Understanding Your Vehicle's True Value",
    excerpt:
      "Market values fluctuate daily. Learn how professional appraisers determine your vehicle's actual worth using comprehensive data analysis.",
    category: 'Valuation Basics',
    readTime: '5 min read',
  },
  {
    id: 2,
    title: 'How VIN Decoding Works',
    excerpt:
      "Your VIN contains critical information about your vehicle's specifications, history, and market comparables. Discover what it reveals.",
    category: 'VIN Analysis',
    readTime: '4 min read',
  },
  {
    id: 3,
    title: 'Market Trends in Vehicle Valuation',
    excerpt:
      'Supply chain issues, seasonal demand, and regional factors all impact vehicle values. Stay informed with current market insights.',
    category: 'Market Data',
    readTime: '6 min read',
  },
]

export default function Hero() {
  const router = useRouter()
  const [activeArticleIndex, setActiveArticleIndex] = useState(0)
  const [rateLimitModal, setRateLimitModal] = useState({
    isOpen: false,
    daysRemaining: 0,
    hoursRemaining: 0,
    nextAvailableDate: '',
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveArticleIndex(prev => (prev + 1) % TOP_ARTICLES.length)
    }, 5000) // Cycle every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const handleGetStartedClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()

    // Check if user is authenticated
    try {
      const sessionResponse = await fetch('/api/auth/session')

      if (!sessionResponse.ok) {
        // Not authenticated - redirect to signup
        router.push('/signup')
        return
      }

      const sessionData = await sessionResponse.json()

      if (!sessionData.user) {
        // Not authenticated - redirect to signup
        router.push('/signup')
        return
      }

      // Authenticated - check rate limit
      const rateLimitResponse = await fetch('/api/reports/can-create')
      const data = await rateLimitResponse.json()

      if (data.canCreate) {
        router.push('/reports/new')
      } else {
        setRateLimitModal({
          isOpen: true,
          daysRemaining: data.daysRemaining,
          hoursRemaining: data.hoursRemainingAfterDays,
          nextAvailableDate: data.nextAvailableDate,
        })
      }
    } catch (error) {
      console.error('Error checking authentication/rate limit:', error)
      // Fallback: redirect to signup on error
      router.push('/signup')
    }
  }

  return (
    <section className="relative min-h-[90vh] flex items-center bg-slate-900 pt-20 overflow-hidden">
      {/* Background Gradient Blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary-600/20 rounded-full blur-[120px] animate-blob" />
        <div
          className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-emerald-900/40 rounded-full blur-[100px] animate-blob"
          style={{ animationDelay: '2s' }}
        />
        <div
          className="absolute top-[20%] left-[20%] w-[300px] h-[300px] bg-blue-900/20 rounded-full blur-[80px] animate-blob"
          style={{ animationDelay: '4s' }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Column: Value Proposition */}
          <div className="animate-fade-in-up">
            <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-emerald-200">
                Here to support owners of vehicles in collisions
              </span>
            </h1>

            <p className="text-lg text-slate-300 mb-8 leading-relaxed max-w-lg">
              Professional vehicle valuation reports for insurance claims, diminished value
              assessments, and total loss negotiations. Get accurate, data-backed valuations within
              24-48 hours.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="group w-full sm:w-auto" onClick={handleGetStartedClick}>
                Get Started
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Link href="/login">
                <Button variant="glass" size="lg" className="w-full sm:w-auto">
                  Sign In
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-6 text-slate-400 text-sm">
              <div className="flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-2 text-primary-500" />
                Accurate Valuations
              </div>
              <div className="flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-2 text-primary-500" />
                Fast Delivery
              </div>
              <div className="flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-2 text-primary-500" />
                Money-Back Guarantee
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Knowledge Cards Carousel */}
          <div className="relative hidden lg:block h-[500px]">
            {/* The Card Stack Visual */}
            <div className="absolute inset-0 flex items-center justify-center">
              {TOP_ARTICLES.map((article, index) => {
                const isActive = index === activeArticleIndex
                const isNext = index === (activeArticleIndex + 1) % TOP_ARTICLES.length

                let transformClass = 'scale-90 opacity-0 translate-y-8 z-0'
                if (isActive) transformClass = 'scale-100 opacity-100 translate-y-0 z-20'
                if (isNext) transformClass = 'scale-95 opacity-40 -translate-y-4 z-10 blur-[1px]'

                return (
                  <div
                    key={article.id}
                    className={`absolute w-full max-w-md transition-all duration-700 ease-in-out ${transformClass}`}
                  >
                    <div className="glass-panel p-8 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden group hover:border-primary-500/30 transition-colors cursor-pointer">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <BookOpen size={120} className="text-white" />
                      </div>

                      <div className="relative z-10">
                        <span className="text-primary-400 text-xs font-bold tracking-wider uppercase mb-2 block">
                          Expert Insights
                        </span>
                        <h3 className="text-2xl font-bold text-white mb-3 leading-snug">
                          {article.title}
                        </h3>
                        <p className="text-slate-300 mb-6 text-sm leading-relaxed">
                          {article.excerpt}
                        </p>

                        <div className="flex justify-between items-center border-t border-white/10 pt-4">
                          <span className="text-slate-400 text-xs bg-slate-800 px-2 py-1 rounded">
                            {article.category}
                          </span>
                          <span className="text-slate-400 text-xs">{article.readTime}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Carousel Indicators */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center space-x-2 z-30">
              {TOP_ARTICLES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveArticleIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === activeArticleIndex
                      ? 'w-8 bg-primary-500'
                      : 'w-2 bg-slate-600 hover:bg-slate-500'
                  }`}
                  aria-label={`Go to article ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Rate Limit Modal */}
      <RateLimitModal
        isOpen={rateLimitModal.isOpen}
        onClose={() => setRateLimitModal({ ...rateLimitModal, isOpen: false })}
        daysRemaining={rateLimitModal.daysRemaining}
        hoursRemaining={rateLimitModal.hoursRemaining}
        nextAvailableDate={rateLimitModal.nextAvailableDate}
      />
    </section>
  )
}
