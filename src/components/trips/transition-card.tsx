import { Clock, Plane } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatShortDate } from '@/lib/utils'
import type { Trip } from '@/types/database'
import type { FlightJourney } from '@/lib/trips/city-segments'

import { TripItemCard } from './trip-item-card'

interface TransitionCardProps {
  journey: FlightJourney
  nextSegmentCity: string
  allTrips: Pick<Trip, 'id' | 'title' | 'start_date'>[]
  currentUserId?: string
  readOnly?: boolean
}

function stopLabel(journey: FlightJourney) {
  if (journey.stopCodes.length === 0) return 'Nonstop'
  if (journey.stopCodes.length === 1) return `1 stop (${journey.stopCodes[0]})`
  return `${journey.stopCodes.length} stops`
}

export function TransitionCard({
  journey,
  nextSegmentCity,
  allTrips,
  currentUserId,
  readOnly = false,
}: TransitionCardProps) {
  return (
    <Card className="border-dashed border-sky-200 bg-sky-50/70">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sky-600">
                <Plane className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Transition</p>
                <h3 className="text-lg font-semibold text-slate-900">
                  Flight to {nextSegmentCity} ({journey.arrival.code})
                </h3>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
              <span>{journey.date ? `${formatShortDate(journey.date)}, ` : ''}{journey.departure.code} {journey.departure.time || '--:--'} to {journey.arrival.code} {journey.arrival.time || '--:--'}</span>
              <span>{stopLabel(journey)}</span>
              {journey.duration ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {journey.duration}
                </span>
              ) : null}
            </div>
          </div>

        </div>

        <div className="mt-4 space-y-3">
          {journey.legs.map((leg) => (
            <TripItemCard
              key={leg.id}
              item={leg}
              allTrips={allTrips}
              currentUserId={currentUserId}
              readOnly={readOnly}
              defaultExpanded
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
