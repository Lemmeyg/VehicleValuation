/**
 * FavoriteButton Component
 *
 * Client-side component for adding/removing suppliers from favorites
 */

'use client'

import { Star } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface FavoriteButtonProps {
  supplierSlug: string
  initialIsFavorited: boolean
  isAuthenticated: boolean
}

export default function FavoriteButton({
  supplierSlug,
  initialIsFavorited,
  isAuthenticated,
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault() // Prevent card click
    e.stopPropagation() // Stop event bubbling

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.push('/login?redirect=/directory')
      return
    }

    setIsLoading(true)

    try {
      if (isFavorited) {
        // Remove from favorites
        const response = await fetch('/api/suppliers/favorites/remove', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supplierSlug }),
        })

        if (response.ok) {
          setIsFavorited(false)
        } else {
          console.error('Failed to remove favorite')
        }
      } else {
        // Add to favorites
        const response = await fetch('/api/suppliers/favorites/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supplierSlug }),
        })

        if (response.ok) {
          setIsFavorited(true)
        } else if (response.status === 409) {
          // Already favorited
          setIsFavorited(true)
        } else {
          console.error('Failed to add favorite')
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    } finally {
      setIsLoading(false)
      router.refresh() // Refresh to update dashboard counts
    }
  }

  return (
    <button
      onClick={handleToggleFavorite}
      disabled={isLoading}
      className={`p-2 rounded-full transition-all ${
        isFavorited
          ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
      } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
      aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Star
        className={`h-5 w-5 ${isFavorited ? 'fill-yellow-600' : ''}`}
        strokeWidth={isFavorited ? 0 : 2}
      />
    </button>
  )
}
