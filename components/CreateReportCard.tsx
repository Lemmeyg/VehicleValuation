'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import RateLimitModal from './RateLimitModal'

export default function CreateReportCard() {
  const router = useRouter()
  const [rateLimitModal, setRateLimitModal] = useState({
    isOpen: false,
    daysRemaining: 0,
    hoursRemaining: 0,
    nextAvailableDate: '',
  })
  const [isChecking, setIsChecking] = useState(false)

  const handleCreateReportClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    setIsChecking(true)

    try {
      const response = await fetch('/api/reports/can-create')
      const data = await response.json()

      if (data.canCreate) {
        // Allowed - navigate to form
        router.push('/reports/new')
      } else {
        // Rate limit exceeded - show modal
        setRateLimitModal({
          isOpen: true,
          daysRemaining: data.daysRemaining,
          hoursRemaining: data.hoursRemainingAfterDays,
          nextAvailableDate: data.nextAvailableDate,
        })
      }
    } catch (error) {
      console.error('Error checking rate limit:', error)
      // Fallback: allow navigation on error
      router.push('/reports/new')
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <>
      <div className="glass-card rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all border border-primary-200 overflow-hidden group bg-gradient-to-br from-primary-50 to-white">
        <div className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-12 w-12 rounded-lg bg-primary-600 flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-semibold text-slate-600 truncate">Create New Report</dt>
                <dd className="text-2xl font-bold text-slate-900">Get Started</dd>
              </dl>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 border-t border-primary-100 px-6 py-3">
          <Link
            href="/reports/new"
            onClick={handleCreateReportClick}
            className={`text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center group-hover:translate-x-1 transition-transform ${
              isChecking ? 'opacity-50 cursor-wait' : 'cursor-pointer'
            }`}
          >
            {isChecking ? 'Checking...' : 'Start new valuation →'}
          </Link>
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
    </>
  )
}
