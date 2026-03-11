'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateRange } from '@/lib/utils'
import { MapPin, Calendar, CalendarDays, AlertCircle, User, Loader2 } from 'lucide-react'
import type { Trip, Json } from '@/types/database'
import { cn } from '@/lib/utils'
import { getProviderLogoUrl } from '@/lib/images/provider-logo'
import { extractAirlineCode } from '@/lib/images/airline-logo'
import { TripStatusSummary } from './trip-status-summary'

interface TripItem {
  id: string
  kind: string
  needs_review: boolean
  provider: string | null
  details_json: Json
  start_date: string
  start_ts: string | null
}

interface TripCardProps {
  trip: Trip & { trip_items?: TripItem[] }
  itemCount: number
  needsReview?: boolean
  isPast?: boolean
  ownerName?: string
  eventsSlug?: string
}

function getProviderLogos(items?: TripItem[]): string[] {
  if (!items) return []
  const seen = new Set<string>()
  const logos: string[] = []

  for (const item of items) {
    const provider = item.provider
    const details = item.details_json as Record<string, unknown> | null

    let url: string | null = null

    if (item.kind === 'flight') {
      const flightNumber = details?.flight_number as string | undefined
      const iataCode = flightNumber ? extractAirlineCode(flightNumber) : null
      const logoFromIata = iataCode ? `https://pics.avs.io/80/80/${iataCode}@2x.png` : null
      const logoFromProvider = !logoFromIata && provider ? getProviderLogoUrl(provider, 'flight') : null
      url = logoFromIata || logoFromProvider
    } else if (provider) {
      url = getProviderLogoUrl(provider, item.kind || 'other')
    }

    if (url && !seen.has(url)) {
      seen.add(url)
      logos.push(url)
    }
  }

  return logos.slice(0, 4) // Max 4 provider logos
}

function ownerTripLabel(ownerName: string): string {
  const trimmed = ownerName.trim()
  if (!trimmed) return 'Shared trip'
  return trimmed.endsWith('s') ? `${trimmed}' trip` : `${trimmed}'s trip`
}

function hasFlightWithin48Hours(items?: TripItem[]): boolean {
  if (!items || items.length === 0) return false

  const nowMs = Date.now()
  const maxMs = nowMs + 48 * 60 * 60 * 1000

  for (const item of items) {
    if (item.kind !== 'flight') continue

    const when = item.start_ts ? new Date(item.start_ts) : new Date(`${item.start_date}T00:00:00Z`)
    const time = when.getTime()
    if (Number.isNaN(time)) continue
    if (time >= nowMs && time <= maxMs) {
      return true
    }
  }

  return false
}

export function getTripCardPlaceholderLabel(trip: Pick<Trip, 'primary_location' | 'title'>): string {
  const location = trip.primary_location?.trim()
  if (location) return location

  const title = trip.title.trim()
  if (!title) return 'Your next trip'

  const parts = title.split('→').map((part) => part.trim()).filter(Boolean)
  return parts.at(-1) ?? title
}

export function TripCard({ trip, itemCount, needsReview, isPast, ownerName, eventsSlug }: TripCardProps) {
  const airlineLogos = getProviderLogos(trip.trip_items)
  const showStatusSummary = hasFlightWithin48Hours(trip.trip_items)
  const placeholderLabel = getTripCardPlaceholderLabel(trip)
  const router = useRouter()
  const [navigating, setNavigating] = useState(false)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setNavigating(true)
      router.push(`/trips/${trip.id}`)
    },
    [router, trip.id]
  )

  return (
    <Link href={`/trips/${trip.id}`} onClick={handleClick}>
      <Card
        className={cn(
          'group cursor-pointer overflow-hidden transition-all hover:shadow-md hover:border-[#cbd5e1]',
          isPast && 'opacity-75',
          navigating && 'ring-2 ring-indigo-400 shadow-md'
        )}
      >
        {/* Cover image */}
        <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-[#eef2ff] via-[#e0e7ff] to-[#f8fafc]">
          {trip.cover_image_url && (
            <Image
              src={trip.cover_image_url}
              alt={trip.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              unoptimized
            />
          )}
          {!trip.cover_image_url && (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_transparent_55%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(79,70,229,0.18),transparent_45%,rgba(15,23,42,0.08))]" />
              <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/60 blur-2xl" />
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white/75 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-between p-4">
                <div className="flex justify-end">
                  <span className="inline-flex items-center rounded-full border border-white/70 bg-white/75 px-2.5 py-1 text-[11px] font-medium text-indigo-700 shadow-sm backdrop-blur">
                    No cover photo
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-white shadow-sm backdrop-blur">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{placeholderLabel}</span>
                  </div>
                  <div>
                    <p className="line-clamp-1 text-lg font-semibold tracking-tight text-slate-900">
                      {placeholderLabel}
                    </p>
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-600">
                      {trip.is_demo ? 'Sample itinerary' : 'Trip overview'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
          {/* Loading overlay */}
          {navigating && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-sm transition-opacity">
              <div className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                <span className="text-sm font-medium text-indigo-600">Loading trip…</span>
              </div>
            </div>
          )}
          {/* Provider logos */}
          {airlineLogos.length > 0 && (
            <div className="absolute bottom-2 right-2 flex -space-x-2">
              {airlineLogos.map((url, i) => (
                <div
                  key={url}
                  className="h-7 w-7 rounded-full border-2 border-white bg-white shadow-sm overflow-hidden"
                  style={{ zIndex: airlineLogos.length - i }}
                >
                  <Image
                    src={url}
                    alt="Provider"
                    width={28}
                    height={28}
                    className="object-contain"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <CardContent className="p-4">
          {/* Header with title and review badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 group-hover:text-[#4338ca] transition-colors line-clamp-1">
                {trip.title}
              </h3>
              {ownerName && (
                <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                  <User className="h-3.5 w-3.5" />
                  <span>{ownerTripLabel(ownerName)}</span>
                </div>
              )}
              <TripStatusSummary tripId={trip.id} enabled={showStatusSummary} />
            </div>
            {trip.is_demo && (
              <Badge variant="secondary" className="shrink-0">
                Sample Trip
              </Badge>
            )}
            {needsReview && (
              <Badge variant="warning" className="shrink-0">
                <AlertCircle className="mr-1 h-3 w-3" />
                Review
              </Badge>
            )}
          </div>

          {/* Location */}
          {trip.primary_location && (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-600">
              <MapPin className="h-4 w-4 text-gray-400" />
              <span className="line-clamp-1">{trip.primary_location}</span>
            </div>
          )}

          {/* Dates */}
          {(trip.start_date || trip.end_date) && (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-600">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
            </div>
          )}

          {/* What's on link */}
          {eventsSlug && !isPast && (
            <Link
              href={`/cities/${eventsSlug}`}
              onClick={(e) => e.stopPropagation()}
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              What&apos;s on in {trip.primary_location?.split(',')[0]}
            </Link>
          )}

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
            {trip.travelers && trip.travelers.length > 0 ? (
              <span className="text-gray-500">
                {trip.travelers.length} {trip.travelers.length === 1 ? 'traveler' : 'travelers'}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
