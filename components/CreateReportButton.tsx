'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RateLimitModal from './RateLimitModal'

export default function CreateReportButton() {
  const router = useRouter()
  const [rateLimitModal, setRateLimitModal] = useState({
    isOpen: false,
    daysRemaining: 0,
    hoursRemaining: 0,
    nextAvailableDate: '',
  })
  const [isChecking, setIsChecking] = useState(false)

  const handleCreateReportClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
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
      <button
        onClick={handleCreateReportClick}
        disabled={isChecking}
        className="inline-flex items-center px-6 py-3 border border-transparent shadow-md text-base font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-wait"
      >
        <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {isChecking ? 'Checking...' : 'Create Your First Report'}
      </button>

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
