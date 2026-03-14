'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatDateRange } from '@/lib/utils'
import type { CitySegment } from '@/lib/trips/city-segments'
import type { Trip } from '@/types/database'
import { TripItemCard } from './trip-item-card'

// Allowed domains for hero images (Supabase storage buckets)
const ALLOWED_HERO_DOMAINS = [
  'cqijgtijuselspyzpphf.supabase.co',
  'localhost',
]

function isValidHeroUrl(url: string | undefined): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return ALLOWED_HERO_DOMAINS.includes(parsed.hostname)
  } catch {
    return false
  }
}

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
  const hasHero = isValidHeroUrl(segment.heroImageUrl)

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      {/* Hero image header */}
      {hasHero ? (
        <div className="relative h-40 sm:h-48">
          <img
            src={segment.heroImageUrl}
            alt={segment.city}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              {segment.isReturnHome ? 'Heading Home' : 'City stay'}
            </p>
            <h3 className="mt-1 text-2xl font-semibold text-white">
              {flagEmoji(segment.countryCode)} {segment.city.toUpperCase()}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-white/20 text-white backdrop-blur-sm">{durationLabel(segment)}</Badge>
              <Badge className="rounded-full border-white/20 bg-white/10 text-white/90 backdrop-blur-sm">{formatDateRange(segment.startDate, segment.endDate)}</Badge>
              {(() => {
                const firstDay = segment.weather?.daily?.[0]
                return firstDay ? (
                  <span className="text-sm text-white/90">
                    {firstDay.emoji} {Math.round(firstDay.high)}° / {Math.round(firstDay.low)}°
                  </span>
                ) : null
              })()}
            </div>
          </div>
        </div>
      ) : null}

      <CardContent className="p-5">
        <div className="flex flex-col gap-4">
          {/* Text-only header when no hero image */}
          {!hasHero ? (
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
          ) : null}

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
        </div>
      </CardContent>
    </Card>
  )
}
