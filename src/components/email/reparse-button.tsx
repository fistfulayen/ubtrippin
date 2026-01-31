'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

interface ReparseButtonProps {
  emailId: string
}

export function ReparseButton({ emailId }: ReparseButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleReparse = async () => {
    setLoading(true)

    try {
      const response = await fetch(`/api/emails/${emailId}/reparse`, {
        method: 'POST',
      })

      if (response.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error('Reparse failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleReparse}
      disabled={loading}
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Re-parsing...' : 'Re-parse email'}
    </Button>
  )
}
