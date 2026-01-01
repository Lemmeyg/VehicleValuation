'use client'

import { useState, useEffect } from 'react'
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
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    isAdmin: boolean
    daysRemaining: number
    hoursRemaining: number
  } | null>(null)

  // Fetch rate limit info on mount to display counter
  useEffect(() => {
    const fetchRateLimitInfo = async () => {
      try {
        const response = await fetch('/api/reports/can-create')
        const data = await response.json()

        if (!data.canCreate && !data.isAdmin) {
          setRateLimitInfo({
            isAdmin: false,
            daysRemaining: data.daysRemaining || 0,
            hoursRemaining: data.hoursRemainingAfterDays || 0,
          })
        } else if (data.isAdmin) {
          setRateLimitInfo({
            isAdmin: true,
            daysRemaining: 0,
            hoursRemaining: 0,
          })
        }
      } catch (error) {
        console.error('Error fetching rate limit info:', error)
      }
    }

    fetchRateLimitInfo()
  }, [])

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
      <div className="flex flex-col items-end gap-2">
        <button
          onClick={handleCreateReportClick}
          disabled={isChecking}
          className="inline-flex items-center px-6 py-3 border border-transparent shadow-md text-base font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-wait"
        >
          <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {isChecking ? 'Checking...' : 'Create New Vehicle Valuation Report'}
        </button>

        {/* Show wait time counter for non-admins who are rate limited */}
        {rateLimitInfo && !rateLimitInfo.isAdmin && rateLimitInfo.daysRemaining > 0 && (
          <p className="text-xs text-slate-500">
            Next report available in: {rateLimitInfo.daysRemaining}d {rateLimitInfo.hoursRemaining}h
          </p>
        )}

        {/* Show admin badge if user is admin */}
        {rateLimitInfo && rateLimitInfo.isAdmin && (
          <p className="text-xs text-emerald-600 font-medium">
            ✓ Admin - No wait time
          </p>
        )}
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
