'use client'

import { useState } from 'react'
import { FlightRefreshButton } from '@/components/flights/flight-refresh-button'

interface FlightRefreshButtonClientProps {
  ident: string
  date: string
  lastUpdated: string
}

export function FlightRefreshButtonClient({
  ident,
  date,
  lastUpdated,
}: FlightRefreshButtonClientProps) {
  const [data, setData] = useState<unknown>(null)

  // For now, just trigger a page reload on refresh
  // In a full implementation, we'd update the UI without reload
  const handleRefresh = (newData: unknown) => {
    setData(newData)
    window.location.reload()
  }

  return (
    <FlightRefreshButton
      ident={ident}
      date={date}
      lastUpdated={lastUpdated}
      onRefresh={handleRefresh}
    />
  )
}
