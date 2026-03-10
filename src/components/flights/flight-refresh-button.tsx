'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FlightRefreshButtonProps {
  ident: string
  date: string
  lastUpdated: string
  onRefresh: (data: unknown) => void
}

export function FlightRefreshButton({
  ident,
  date,
  lastUpdated,
  onRefresh,
}: FlightRefreshButtonProps) {
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const response = await fetch(`/api/v1/flights/${ident}/${date}/live`, {
        cache: 'no-store',
      })
      if (response.ok) {
        const data = await response.json()
        onRefresh(data)
      }
    } finally {
      setRefreshing(false)
    }
  }

  const updatedAgo = Math.round(
    (Date.now() - new Date(lastUpdated).getTime()) / 60000
  )
  const updatedText = updatedAgo < 1 ? 'Just now' : `${updatedAgo} min ago`

  return (
    <div className="flex items-center gap-3 text-sm text-slate-500">
      <span>Last updated: {updatedText}</span>
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={refreshing}
        className="h-8"
      >
        {refreshing ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </>
        )}
      </Button>
    </div>
  )
}
