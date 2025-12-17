'use client'

import { CheckCircle2, Sparkles } from 'lucide-react'
import { Button } from './ui/Button'

interface FreeTierModalProps {
  isOpen: boolean
  onClose: () => void
  onContinue: () => void
}

export default function FreeTierModal({ isOpen, onClose, onContinue }: FreeTierModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Gradient Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-primary-600 p-8 text-white">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-white/20 rounded-full p-3">
              <Sparkles className="h-12 w-12" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-center mb-2">Great News!</h2>
          <p className="text-center text-emerald-50">
            You&apos;ve been selected for our beta program
          </p>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-6 mb-6">
            <p className="text-lg text-center font-semibold text-slate-900 mb-2">
              This product is free for a limited time while we are in beta testing
            </p>
            <p className="text-center text-slate-600 text-sm">
              Help us improve by providing feedback on your report
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-3 mb-6">
            <div className="flex items-start">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mr-3 flex-shrink-0 mt-0.5" />
              <span className="text-slate-700">Full access to premium features</span>
            </div>
            <div className="flex items-start">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mr-3 flex-shrink-0 mt-0.5" />
              <span className="text-slate-700">Instant report generation</span>
            </div>
            <div className="flex items-start">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mr-3 flex-shrink-0 mt-0.5" />
              <span className="text-slate-700">No credit card required</span>
            </div>
            <div className="flex items-start">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mr-3 flex-shrink-0 mt-0.5" />
              <span className="text-slate-700">PDF download included</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={onContinue}
              className="w-full py-4 text-lg font-semibold bg-gradient-to-r from-emerald-600 to-primary-600 hover:from-emerald-700 hover:to-primary-700"
            >
              Continue to Report
            </Button>
            <button
              onClick={onClose}
              className="w-full py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Fine Print */}
          <p className="text-xs text-center text-slate-500 mt-6">
            * Beta access is subject to availability and may end at any time
          </p>
        </div>
      </div>
    </div>
  )
}
