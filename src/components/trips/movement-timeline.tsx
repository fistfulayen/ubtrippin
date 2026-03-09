'use client'

import type { Trip } from '@/types/database'
import type { TimelineEntry } from '@/lib/trips/city-segments'

import { CitySegmentBlock } from './city-segment-block'
import { TransitionCard } from './transition-card'

interface MovementTimelineProps {
  entries: TimelineEntry[]
  allTrips: Pick<Trip, 'id' | 'title' | 'start_date'>[]
  currentUserId?: string
  readOnly?: boolean
}

export function MovementTimeline({
  entries,
  allTrips,
  currentUserId,
  readOnly = false,
}: MovementTimelineProps) {
  if (entries.length === 0) return null

  return (
    <div className="space-y-4">
      {entries.map((entry, index) => {
        if (entry.type === 'transition' && entry.transition) {
          const nextSegment = entries.slice(index + 1).find((candidate) => candidate.type === 'segment')?.segment
          return (
            <TransitionCard
              key={`${entry.transition.date}-${entry.transition.departure.code}-${entry.transition.arrival.code}-${index}`}
              journey={entry.transition}
              nextSegmentCity={entry.nextSegmentCity ?? nextSegment?.city ?? entry.transition.arrival.city}
              allTrips={allTrips}
              currentUserId={currentUserId}
              readOnly={readOnly}
            />
          )
        }

        if (entry.type === 'segment' && entry.segment) {
          return (
            <CitySegmentBlock
              key={`${entry.segment.city}-${entry.segment.startDate}-${index}`}
              segment={entry.segment}
              allTrips={allTrips}
              currentUserId={currentUserId}
              readOnly={readOnly}
            />
          )
        }

        return null
      })}
    </div>
  )
}
