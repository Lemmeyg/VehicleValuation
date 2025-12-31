/**
 * ContactRequestButton Component
 *
 * Opens a dialog/toast form for submitting contact requests to suppliers
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ContactRequestDialog from './ContactRequestDialog'

interface ContactRequestButtonProps {
  supplierSlug: string
  businessName: string
  isAuthenticated: boolean
  userName: string
  userEmail: string
}

export default function ContactRequestButton({
  supplierSlug,
  businessName,
  isAuthenticated,
  userName,
  userEmail,
}: ContactRequestButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const handleClick = () => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/directory')
      return
    }
    setIsOpen(true)
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="block w-full text-center px-4 py-3 bg-gradient-to-r from-primary-600 to-emerald-600 text-white font-semibold rounded-lg hover:from-primary-700 hover:to-emerald-700 transition-all shadow-sm hover:shadow-md"
      >
        Contact Request
      </button>

      <ContactRequestDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        supplierSlug={supplierSlug}
        businessName={businessName}
        userName={userName}
        userEmail={userEmail}
      />
    </>
  )
}
