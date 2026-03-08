'use client'

import type { Trip, TripItem } from '@/types/database'
import { buildCitySegments } from '@/lib/trips/city-segments'
import { MovementTimeline } from './movement-timeline'

interface TripTimelineProps {
  items: TripItem[]
  tripId: string
  allTrips: Pick<Trip, 'id' | 'title' | 'start_date'>[]
  currentUserId?: string
}

export function TripTimeline({ items, tripId, allTrips, currentUserId }: TripTimelineProps) {
  return (
    <MovementTimeline
      segments={buildCitySegments(items)}
      tripId={tripId}
      allTrips={allTrips}
      currentUserId={currentUserId}
    />
  )
}
