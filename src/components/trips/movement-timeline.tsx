'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, Plus } from 'lucide-react'
import type { Trip } from '@/types/database'
import type { CitySegment } from '@/lib/trips/city-segments'
import type { WeatherResponsePayload } from '@/lib/weather/types'
import { attachWeatherToSegments } from '@/lib/weather/item-weather'
import { PackingSuggestions } from './weather/packing-suggestions'
import { CitySegmentHeader } from './city-segment-header'
import { TripItemCard } from './trip-item-card'
import { TransitionFlight } from './transition-flight'
import { Card, CardContent } from '@/components/ui/card'

interface MovementTimelineProps {
  segments: CitySegment[]
  tripId: string
  allTrips: Pick<Trip, 'id' | 'title' | 'start_date'>[]
  currentUserId?: string
  weatherEndpoint?: string
  initialWeather?: WeatherResponsePayload | null
  readOnly?: boolean
  showPacking?: boolean
}

function formatSpineDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function MovementTimeline({
  segments,
  tripId,
  allTrips,
  currentUserId,
  weatherEndpoint,
  initialWeather,
  readOnly = false,
  showPacking = true,
}: MovementTimelineProps) {
  const [weatherData, setWeatherData] = useState<WeatherResponsePayload | null | undefined>(initialWeather)

  useEffect(() => {
    if (initialWeather !== undefined) {
      setWeatherData(initialWeather)
    }
  }, [initialWeather])

  useEffect(() => {
    if (!weatherEndpoint || initialWeather !== undefined) return

    let cancelled = false
    fetch(weatherEndpoint, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null
        return response.json() as Promise<WeatherResponsePayload>
      })
      .then((payload) => {
        if (!cancelled) setWeatherData(payload)
      })
      .catch(() => {
        if (!cancelled) setWeatherData(null)
      })

    return () => {
      cancelled = true
    }
  }, [initialWeather, weatherEndpoint])

  const segmentsWithWeather = attachWeatherToSegments(segments, weatherData)

  if (segmentsWithWeather.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
        <Calendar className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-4 font-semibold text-gray-900">No items yet</h3>
        <p className="mt-1 text-sm text-gray-600">
          Add reservations, flights, and activities to build your itinerary.
        </p>
        {!readOnly ? (
          <Link
            href={`/trips/${tripId}/add-item`}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1e293b] px-4 py-2 text-sm font-medium text-white hover:bg-[#312e81]"
          >
            <Plus className="h-4 w-4" />
            Add first item
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {segmentsWithWeather.map((segment, index) => (
        <div key={`${segment.city}-${segment.startDate}-${index}`} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[104px_minmax(0,1fr)] md:items-start">
            <div className="hidden md:block md:pt-6">
              <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Stop</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{formatSpineDate(segment.startDate)}</div>
              </div>
            </div>

            <Card className="overflow-hidden border-slate-200 shadow-sm shadow-slate-200/70">
              <CitySegmentHeader segment={segment} />
              <CardContent className="space-y-4 p-4 pt-4 sm:p-5">
                {segment.items.map((item) => (
                  <TripItemCard
                    key={item.id}
                    item={item}
                    allTrips={allTrips}
                    currentUserId={currentUserId}
                    readOnly={readOnly}
                    weather={item.weather}
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          {index < segmentsWithWeather.length - 1 && segment.transitions.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-[104px_minmax(0,1fr)]">
              <div className="hidden md:block" />
              <div className="space-y-2">
                {segment.transitions.map((flight) => (
                  <TransitionFlight
                    key={flight.id}
                    flight={flight}
                    destinationCity={segmentsWithWeather[index + 1].city}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ))}

      {showPacking && weatherData && !weatherData.should_hide_section ? (
        <PackingSuggestions
          packing={weatherData.packing}
          locked={showPacking && !weatherData.can_view_packing}
        />
      ) : null}
    </div>
  )
}
