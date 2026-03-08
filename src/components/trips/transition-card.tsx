'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Clock, Plane } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { Trip } from '@/types/database'
import type { FlightJourney } from '@/lib/trips/city-segments'
import type { TimelineWeatherDay } from '@/lib/weather/item-weather'
import { TripItemCard } from './trip-item-card'

interface TransitionCardProps {
  journey: FlightJourney
  nextSegmentCity: string
  weather?: TimelineWeatherDay | null
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
  weather,
  allTrips,
  currentUserId,
  readOnly = false,
}: TransitionCardProps) {
  const [expanded, setExpanded] = useState(false)

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
              <span>{journey.departure.code} {journey.departure.time || '--:--'} to {journey.arrival.code} {journey.arrival.time || '--:--'}</span>
              <span>{stopLabel(journey)}</span>
              {journey.duration ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {journey.duration}
                </span>
              ) : null}
            </div>
          </div>

          {weather ? (
            <div className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm">
              {weather.emoji} {Math.round(weather.high)}° / {Math.round(weather.low)}°
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-4 flex items-center gap-1 text-sm font-medium text-sky-700 hover:text-sky-800"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          More info
        </button>

        {expanded ? (
          <div className="mt-4 space-y-3">
            {journey.legs.map((leg) => (
              <TripItemCard
                key={leg.id}
                item={leg}
                allTrips={allTrips}
                currentUserId={currentUserId}
                readOnly={readOnly}
              />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
