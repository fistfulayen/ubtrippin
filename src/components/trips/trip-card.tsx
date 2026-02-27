import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateRange } from '@/lib/utils'
import { MapPin, Calendar, AlertCircle, Users } from 'lucide-react'
import type { Trip, Json } from '@/types/database'
import { cn } from '@/lib/utils'
import { getProviderLogoUrl } from '@/lib/images/provider-logo'
import { extractAirlineCode } from '@/lib/images/airline-logo'

interface TripItem {
  id: string
  kind: string
  needs_review: boolean
  provider: string | null
  details_json: Json
}

interface TripCardProps {
  trip: Trip & { trip_items?: TripItem[] }
  itemCount: number
  needsReview?: boolean
  isPast?: boolean
  isShared?: boolean
  sharedByName?: string
}

function getAirlineLogos(items?: TripItem[]): string[] {
  if (!items) return []
  const seen = new Set<string>()
  const logos: string[] = []

  for (const item of items) {
    if (item.kind !== 'flight') continue

    // Try provider field first, then flight_number from details_json
    const airline = item.provider
    const details = item.details_json as Record<string, unknown> | null
    const flightNumber = details?.flight_number as string | undefined

    // Best strategy: extract IATA from flight number (e.g. "AF1234" → "AF")
    const iataCode = flightNumber ? extractAirlineCode(flightNumber) : null
    const logoFromIata = iataCode ? `https://pics.avs.io/80/80/${iataCode}@2x.png` : null
    // Fallback: try provider name lookup
    const logoFromProvider = !logoFromIata && airline ? getProviderLogoUrl(airline, 'flight') : null
    const url = logoFromIata || logoFromProvider

    if (url && !seen.has(url)) {
      seen.add(url)
      logos.push(url)
    }
  }

  return logos.slice(0, 3) // Max 3 airline logos
}

export function TripCard({ trip, itemCount, needsReview, isPast, isShared, sharedByName }: TripCardProps) {
  const airlineLogos = getAirlineLogos(trip.trip_items)

  return (
    <Link href={`/trips/${trip.id}`}>
      <Card
        className={cn(
          'group cursor-pointer overflow-hidden transition-all hover:shadow-md hover:border-[#cbd5e1]',
          isPast && 'opacity-75'
        )}
      >
        {/* Cover image */}
        <div className="relative h-36 w-full bg-gradient-to-br from-[#f1f5f9] to-[#ffffff]">
          {trip.cover_image_url && (
            <Image
              src={trip.cover_image_url}
              alt={trip.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          )}
          {/* Airline logos */}
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
                    alt="Airline"
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
            <h3 className="font-semibold text-gray-900 group-hover:text-[#4338ca] transition-colors line-clamp-1">
              {trip.title}
            </h3>
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

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
            {isShared && sharedByName ? (
              <span className="flex items-center gap-1 text-indigo-600">
                <Users className="h-3.5 w-3.5" />
                {sharedByName}
              </span>
            ) : trip.travelers && trip.travelers.length > 0 ? (
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
