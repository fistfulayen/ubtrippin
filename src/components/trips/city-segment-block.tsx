'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatDateRange } from '@/lib/utils'
import type { CitySegment } from '@/lib/trips/city-segments'
import type { Trip } from '@/types/database'
import type { CityEvent, TrackedCity } from '@/types/events'
import { TripItemCard } from './trip-item-card'

interface CitySegmentBlockProps {
  segment: CitySegment
  allTrips: Pick<Trip, 'id' | 'title' | 'start_date'>[]
  currentUserId?: string
  readOnly?: boolean
  events?: { city: TrackedCity; events: CityEvent[] }
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
  events,
}: CitySegmentBlockProps) {
  const hasHotel = segment.items.some((item) => item.kind === 'hotel')

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {segment.isReturnHome ? 'Heading Home' : 'City stay'}
              </p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-950">
                {flagEmoji(segment.countryCode)} {segment.city.toUpperCase()}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
                <Badge variant="secondary">{durationLabel(segment)}</Badge>
                <Badge variant="outline">{formatDateRange(segment.startDate, segment.endDate)}</Badge>
              </div>
            </div>

            {(() => {
              const firstDay = segment.weather?.daily?.[0]
              return firstDay ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {firstDay.emoji} {Math.round(firstDay.high)}° / {Math.round(firstDay.low)}°
                </div>
              ) : null
            })()}
          </div>

          {!hasHotel && !segment.isReturnHome ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              No accommodation details
            </div>
          ) : null}

          <div className="space-y-3">
            {segment.items.map((item) => (
                <TripItemCard
                  key={item.id}
                  item={item}
                  allTrips={allTrips}
                  currentUserId={currentUserId}
                  readOnly={readOnly}
                />
            ))}
          </div>

          {events && events.events.length > 0 ? (
            <div className="border-t border-slate-100 pt-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  What&apos;s happening in {events.city.city}
                </p>
                <Link
                  href={`/cities/${events.city.slug}?from=${segment.startDate}&to=${segment.endDate}`}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  See all →
                </Link>
              </div>
              <div className="space-y-2">
                {events.events.slice(0, 3).map((event) => (
                  <div key={event.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{event.title}</p>
                      <p className="text-xs text-slate-500">{formatDate(event.start_date)}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 capitalize">{event.category}</Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
