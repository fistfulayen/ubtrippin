'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatDateRange } from '@/lib/utils'
import { weatherForItem, type CitySegment } from '@/lib/trips/city-segments'
import type { Trip } from '@/types/database'
import { TripItemCard } from './trip-item-card'

interface CitySegmentBlockProps {
  segment: CitySegment
  allTrips: Pick<Trip, 'id' | 'title' | 'start_date'>[]
  currentUserId?: string
  readOnly?: boolean
}

function flagEmoji(countryCode?: string) {
  if (!countryCode || countryCode.length !== 2) return '📍'
  return String.fromCodePoint(...countryCode.toUpperCase().split('').map((char) => 127397 + char.charCodeAt(0)))
}

function durationLabel(segment: CitySegment) {
  if (segment.durationNights === 0) return `Arriving ${formatDate(segment.startDate)}`
  if (segment.durationNights === 1) return '1 Night'
  return `${segment.durationNights} Nights`
}

export function CitySegmentBlock({
  segment,
  allTrips,
  currentUserId,
  readOnly = false,
}: CitySegmentBlockProps) {
  const hasHotel = segment.items.some((item) => item.kind === 'hotel')

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">City stay</p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-950">
                {flagEmoji(segment.countryCode)} {segment.city.toUpperCase()}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
                <Badge variant="secondary">{durationLabel(segment)}</Badge>
                <Badge variant="outline">{formatDateRange(segment.startDate, segment.endDate)}</Badge>
              </div>
            </div>

            {segment.weather?.daily?.length ? (
              <div className="flex flex-wrap gap-2">
                {segment.weather.daily.map((day) => (
                  <div key={day.date} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {day.emoji} {Math.round(day.high)}°
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {!hasHotel ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              No accommodation details
            </div>
          ) : null}

          <div className="space-y-3">
            {segment.items.map((item) => {
              const itemWeather = weatherForItem(segment, item)
              return (
                <TripItemCard
                  key={item.id}
                  item={item}
                  allTrips={allTrips}
                  currentUserId={currentUserId}
                  readOnly={readOnly}
                  metaChips={
                    itemWeather ? (
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {itemWeather.emoji} {Math.round(itemWeather.high)}° / {Math.round(itemWeather.low)}°
                      </span>
                    ) : null
                  }
                />
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
