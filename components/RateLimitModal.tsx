'use client'

import { useEffect, useState } from 'react'
import { X, Clock } from 'lucide-react'

interface RateLimitModalProps {
  isOpen: boolean
  onClose: () => void
  daysRemaining: number
  hoursRemaining: number
  nextAvailableDate: string
}

export default function RateLimitModal({
  isOpen,
  onClose,
  daysRemaining,
  hoursRemaining,
  nextAvailableDate,
}: RateLimitModalProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(true)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 200) // Wait for fade-out animation
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 transition-opacity duration-200 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={`glass-card rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 transition-all duration-200 ${
            isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="rate-limit-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <h2 id="rate-limit-title" className="text-2xl font-bold text-slate-900">
                Weekly Report Limit Reached
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex-1">
                <p className="text-slate-700 leading-relaxed text-base">
                  You can create one report per week. Your next report will be available in{' '}
                  <span className="font-bold text-slate-900">
                    {daysRemaining > 0 && `${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`}
                    {daysRemaining > 0 && hoursRemaining > 0 && ' and '}
                    {hoursRemaining > 0 && `${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''}`}
                  </span>
                  .
                </p>
              </div>
            </div>

            {/* Additional Info Card */}
            <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Next available:</span>{' '}
                {new Date(nextAvailableDate).toLocaleString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}
              </p>
            </div>

            {/* Info Message */}
            <div className="flex items-start space-x-2 text-sm text-slate-500">
              <svg
                className="h-5 w-5 text-primary-500 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p>
                This limit helps us maintain service quality and ensure fair access for all users.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-200">
            <button
              onClick={handleClose}
              className="w-full px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg active:scale-95"
            >
              Got It
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
