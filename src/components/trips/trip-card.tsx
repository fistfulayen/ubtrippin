import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateRange } from '@/lib/utils'
import { MapPin, Calendar, AlertCircle } from 'lucide-react'
import type { Trip } from '@/types/database'
import { cn } from '@/lib/utils'

interface TripCardProps {
  trip: Trip
  itemCount: number
  needsReview?: boolean
  isPast?: boolean
}

export function TripCard({ trip, itemCount, needsReview, isPast }: TripCardProps) {
  return (
    <Link href={`/trips/${trip.id}`}>
      <Card
        className={cn(
          'group cursor-pointer transition-all hover:shadow-md hover:border-amber-200',
          isPast && 'opacity-75'
        )}
      >
        <CardContent className="p-4">
          {/* Header with title and review badge */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 group-hover:text-amber-700 transition-colors line-clamp-1">
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
            {trip.travelers && trip.travelers.length > 0 && (
              <span className="text-gray-500">
                {trip.travelers.length} {trip.travelers.length === 1 ? 'traveler' : 'travelers'}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
