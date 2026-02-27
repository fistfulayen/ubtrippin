'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface AcceptFamilyInviteButtonProps {
  token: string
}

export function AcceptFamilyInviteButton({ token }: AcceptFamilyInviteButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAccept = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/v1/family-invites/${token}/accept`, {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        router.push('/settings/family')
        return
      }

      const payload = await response.json().catch(() => null)
      const message = (payload as { error?: { message?: string } } | null)?.error?.message
      setError(message || 'Failed to accept family invite.')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <Button className="w-full" size="lg" onClick={handleAccept} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Accepting...
          </>
        ) : (
          'Accept invite'
        )}
      </Button>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  )
}
