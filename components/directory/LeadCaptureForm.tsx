/**
 * LeadCaptureForm Component
 *
 * Form for users to submit lead inquiries to suppliers
 * Handles validation, submission, and user feedback
 */

'use client'

import { useState } from 'react'
import { z } from 'zod'
import { Send, CheckCircle, AlertCircle } from 'lucide-react'

interface LeadCaptureFormProps {
  supplierSlug: string
  supplierName: string
}

// Zod validation schema
const LeadSchema = z.object({
  contactName: z.string().min(2, 'Name must be at least 2 characters'),
  contactEmail: z.string().email('Please enter a valid email address'),
  contactPhone: z.string().optional(),
  serviceNeeded: z.string().min(1, 'Please select a service'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  preferredContactMethod: z.enum(['email', 'phone']),
})

type LeadFormData = z.infer<typeof LeadSchema>

export default function LeadCaptureForm({ supplierSlug, supplierName }: LeadCaptureFormProps) {
  const [formData, setFormData] = useState<LeadFormData>({
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    serviceNeeded: '',
    message: '',
    preferredContactMethod: 'email',
  })

  const [errors, setErrors] = useState<Partial<Record<keyof LeadFormData, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error for this field when user starts typing
    if (errors[name as keyof LeadFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setSubmitStatus('idle')
    setErrorMessage('')

    // Validate with Zod
    const result = LeadSchema.safeParse(formData)

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof LeadFormData, string>> = {}
      result.error.issues.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof LeadFormData] = err.message
        }
      })
      setErrors(fieldErrors)
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/suppliers/leads/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supplierSlug,
          ...formData,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit lead')
      }

      setSubmitStatus('success')
      // Reset form
      setFormData({
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        serviceNeeded: '',
        message: '',
        preferredContactMethod: 'email',
      })
    } catch (error) {
      console.error('Lead submission error:', error)
      setSubmitStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-primary-50 to-emerald-50 rounded-xl shadow-lg p-6 border border-primary-200">
      <h3 className="text-xl font-bold text-slate-900 mb-2">Get in Touch</h3>
      <p className="text-sm text-slate-600 mb-6">
        Fill out the form below and {supplierName} will contact you shortly.
      </p>

      {submitStatus === 'success' ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <h4 className="text-lg font-bold text-slate-900 mb-2">Message Sent!</h4>
          <p className="text-sm text-slate-600 mb-4">
            Your inquiry has been submitted successfully. {supplierName} will contact you soon.
          </p>
          <button
            onClick={() => setSubmitStatus('idle')}
            className="text-sm text-primary-600 hover:text-primary-700 font-semibold"
          >
            Send Another Message
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="contactName" className="block text-sm font-semibold text-slate-900 mb-1">
              Your Name *
            </label>
            <input
              type="text"
              id="contactName"
              name="contactName"
              value={formData.contactName}
              onChange={handleChange}
              className={`w-full px-4 py-2 rounded-lg border ${
                errors.contactName ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-primary-500'
              } focus:outline-none focus:ring-2 text-sm text-slate-900`}
              placeholder="John Smith"
            />
            {errors.contactName && (
              <p className="mt-1 text-xs text-red-600">{errors.contactName}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="contactEmail" className="block text-sm font-semibold text-slate-900 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              id="contactEmail"
              name="contactEmail"
              value={formData.contactEmail}
              onChange={handleChange}
              className={`w-full px-4 py-2 rounded-lg border ${
                errors.contactEmail ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-primary-500'
              } focus:outline-none focus:ring-2 text-sm text-slate-900`}
              placeholder="john@example.com"
            />
            {errors.contactEmail && (
              <p className="mt-1 text-xs text-red-600">{errors.contactEmail}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="contactPhone" className="block text-sm font-semibold text-slate-900 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              id="contactPhone"
              name="contactPhone"
              value={formData.contactPhone}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-slate-900"
              placeholder="(555) 123-4567"
            />
          </div>

          {/* Service Needed */}
          <div>
            <label htmlFor="serviceNeeded" className="block text-sm font-semibold text-slate-900 mb-1">
              Service Needed *
            </label>
            <select
              id="serviceNeeded"
              name="serviceNeeded"
              value={formData.serviceNeeded}
              onChange={handleChange}
              className={`w-full px-4 py-2 rounded-lg border ${
                errors.serviceNeeded ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-primary-500'
              } focus:outline-none focus:ring-2 text-sm text-slate-900 bg-white`}
            >
              <option value="">Select a service...</option>
              <option value="vehicle_appraisal">Vehicle Appraisal</option>
              <option value="total_loss_claim">Total Loss Claim Support</option>
              <option value="diminished_value">Diminished Value Assessment</option>
              <option value="insurance_negotiation">Insurance Negotiation</option>
              <option value="claim_dispute">Claim Dispute Resolution</option>
              <option value="other">Other</option>
            </select>
            {errors.serviceNeeded && (
              <p className="mt-1 text-xs text-red-600">{errors.serviceNeeded}</p>
            )}
          </div>

          {/* Message */}
          <div>
            <label htmlFor="message" className="block text-sm font-semibold text-slate-900 mb-1">
              Message *
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows={4}
              className={`w-full px-4 py-2 rounded-lg border ${
                errors.message ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-primary-500'
              } focus:outline-none focus:ring-2 text-sm text-slate-900 resize-none`}
              placeholder="Tell us about your situation and how we can help..."
            />
            {errors.message && <p className="mt-1 text-xs text-red-600">{errors.message}</p>}
          </div>

          {/* Preferred Contact Method */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Preferred Contact Method *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="preferredContactMethod"
                  value="email"
                  checked={formData.preferredContactMethod === 'email'}
                  onChange={handleChange}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-slate-300"
                />
                <span className="ml-2 text-sm text-slate-900">Email</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="preferredContactMethod"
                  value="phone"
                  checked={formData.preferredContactMethod === 'phone'}
                  onChange={handleChange}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-slate-300"
                />
                <span className="ml-2 text-sm text-slate-900">Phone</span>
              </label>
            </div>
          </div>

          {/* Error Message */}
          {submitStatus === 'error' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">Submission Failed</p>
                <p className="text-xs text-red-700">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-emerald-600 text-white font-semibold rounded-lg hover:from-primary-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Sending...
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                Send Message
              </>
            )}
          </button>

          <p className="text-xs text-slate-700 text-center">
            By submitting this form, you agree to be contacted by {supplierName}.
          </p>
        </form>
      )}
    </div>
  )
}
