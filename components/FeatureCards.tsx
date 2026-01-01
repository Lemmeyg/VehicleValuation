'use client'

import { FileText, Users, BookOpen } from 'lucide-react'

interface FeatureCard {
  id: number
  title: string
  description: string
  icon: React.ReactNode
  targetSection: string
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    id: 1,
    title: 'Vehicle Valuation',
    description:
      'Get accurate, professional valuations for your vehicle. Our comprehensive reports help you negotiate with insurance companies and get the settlement you deserve.',
    icon: <FileText className="h-12 w-12" />,
    targetSection: '#valuation',
  },
  {
    id: 2,
    title: 'Directory',
    description:
      'Find trusted service providers in your area. Connect with certified appraisers, repair shops, and legal professionals who specialize in collision claims.',
    icon: <Users className="h-12 w-12" />,
    targetSection: '#directory',
  },
  {
    id: 3,
    title: 'Knowledge Base Articles',
    description:
      'Access expert guides and resources to understand vehicle valuation, insurance claims, and your rights. Stay informed and make better decisions.',
    icon: <BookOpen className="h-12 w-12" />,
    targetSection: '#knowledge-base',
  },
]

export default function FeatureCards() {
  const handleCardClick = (targetSection: string) => {
    const element = document.querySelector(targetSection)
    if (element) {
      const offset = 80
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth',
      })
    }
  }

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Our Services</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Explore our comprehensive suite of tools and resources designed to help you through
            every step of your vehicle claim
          </p>
        </div>

        {/* Display all 3 cards side by side */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {FEATURE_CARDS.map(card => (
            <div
              key={card.id}
              onClick={() => handleCardClick(card.targetSection)}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all cursor-pointer border-2 border-white hover:border-primary-300 group transform hover:-translate-y-2"
            >
              <div className="flex flex-col items-center text-center h-full">
                {/* Icon */}
                <div className="mb-6 p-6 bg-gradient-to-br from-primary-500 to-emerald-600 rounded-2xl text-white group-hover:scale-110 transition-transform shadow-md">
                  {card.icon}
                </div>

                {/* Title */}
                <h3 className="text-2xl font-bold text-slate-900 mb-4 group-hover:text-primary-600 transition-colors">
                  {card.title}
                </h3>

                {/* Description */}
                <p className="text-base text-slate-600 leading-relaxed flex-grow">
                  {card.description}
                </p>

                {/* CTA */}
                <div className="mt-6 text-primary-600 font-semibold group-hover:text-primary-700 flex items-center">
                  Explore
                  <svg
                    className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform"
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
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
