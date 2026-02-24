'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatTime, getLocalTimes, cn } from '@/lib/utils'
import {
  Plane,
  Building,
  TrainFront,
  Car,
  Utensils,
  Ticket,
  Calendar,
  AlertCircle,
  MoreHorizontal,
  Trash2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  Hash,
} from 'lucide-react'
import type { TripItem, Trip, FlightDetails, HotelDetails, TrainDetails, CarRentalDetails, Json } from '@/types/database'
import { getAirlineLogoUrl } from '@/lib/images/airline-logo'
import {
  FlightDetailsView,
  HotelDetailsView,
  TrainDetailsView,
  CarDetailsView,
  GenericDetailsView,
} from './item-details'

interface TripItemCardProps {
  item: TripItem
  allTrips: Pick<Trip, 'id' | 'title' | 'start_date'>[]
}

const kindIcons: Record<string, typeof Plane> = {
  flight: Plane,
  hotel: Building,
  train: TrainFront,
  car: Car,
  restaurant: Utensils,
  activity: Ticket,
  other: Calendar,
}

const kindLabels: Record<string, string> = {
  flight: 'Flight',
  hotel: 'Hotel',
  train: 'Train',
  car: 'Car Rental',
  restaurant: 'Restaurant',
  activity: 'Activity',
  other: 'Other',
}

export function TripItemCard({ item, allTrips }: TripItemCardProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [moving, setMoving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [moveTarget, setMoveTarget] = useState<string>('')

  const [logoError, setLogoError] = useState(false)
  const Icon = kindIcons[item.kind] || Calendar
  const details = item.details_json as FlightDetails | HotelDetails | null
  const airlineLogoUrl = item.kind === 'flight' && item.provider
    ? getAirlineLogoUrl(item.provider)
    : null

  const handleDelete = async () => {
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('trip_items').delete().eq('id', item.id)
    setDeleteOpen(false)
    // Regenerate trip name in the background (fire-and-forget)
    fetch(`/api/v1/trips/${item.trip_id}/rename`, { method: 'POST' }).catch(() => {})
    router.refresh()
  }

  const handleMove = async () => {
    if (!moveTarget) return
    setMoving(true)
    const supabase = createClient()
    await supabase.from('trip_items').update({ trip_id: moveTarget }).eq('id', item.id)
    setMoveOpen(false)
    // Regenerate names on both source and target trips (fire-and-forget)
    fetch(`/api/v1/trips/${item.trip_id}/rename`, { method: 'POST' }).catch(() => {})
    fetch(`/api/v1/trips/${moveTarget}/rename`, { method: 'POST' }).catch(() => {})
    router.refresh()
  }

  const otherTrips = allTrips.filter((t) => t.id !== item.trip_id)

  return (
    <>
      <Card
        className={cn(
          'relative overflow-hidden',
          item.needs_review && 'border-yellow-300 bg-yellow-50/50'
        )}
      >
        <CardContent className="p-4">
          {/* Header row */}
          <div className="flex items-start gap-3">
            {/* Icon — airline logo for flights, generic icon for others */}
            {airlineLogoUrl && !logoError ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white border border-gray-200 overflow-hidden">
                <Image
                  src={airlineLogoUrl}
                  alt={item.provider || 'Airline'}
                  width={32}
                  height={32}
                  className="object-contain"
                  onError={() => setLogoError(true)}
                />
              </div>
            ) : (
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                  item.kind === 'flight' && 'bg-blue-100 text-blue-600',
                  item.kind === 'hotel' && 'bg-purple-100 text-purple-600',
                  item.kind === 'train' && 'bg-green-100 text-green-600',
                  item.kind === 'car' && 'bg-[#f1f5f9] text-[#4f46e5]',
                  item.kind === 'restaurant' && 'bg-red-100 text-red-600',
                  item.kind === 'activity' && 'bg-pink-100 text-pink-600',
                  item.kind === 'other' && 'bg-gray-100 text-gray-600'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
            )}

            {/* Content */}
            <div className="min-w-0 flex-1">
              {/* Title line */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  {kindLabels[item.kind]}
                </span>
                {item.needs_review && (
                  <Badge variant="warning" className="text-xs">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Review
                  </Badge>
                )}
              </div>

              {/* Provider/Summary */}
              <h4 className="mt-1 font-semibold text-gray-900">
                {item.provider || item.summary || 'Untitled'}
              </h4>

              {/* Time and location */}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                {(() => {
                  const det = item.details_json as Record<string, unknown> | null
                  if (!item.start_ts && !det?.departure_local_time && !det?.check_in_time) return null
                  const [start, end] = getLocalTimes({ start_ts: item.start_ts, end_ts: item.end_ts, details: det })
                  return (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {start}
                      {end && ` - ${end}`}
                    </span>
                  )
                })()}

                {item.start_location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {item.start_location}
                    {item.end_location && item.end_location !== item.start_location && (
                      <>
                        <ArrowRight className="h-3 w-3" />
                        {item.end_location}
                      </>
                    )}
                  </span>
                )}

                {item.confirmation_code && (
                  <span className="flex items-center gap-1 font-mono">
                    <Hash className="h-3.5 w-3.5" />
                    {item.confirmation_code}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>

              {menuOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border bg-white py-1 shadow-lg">
                  {otherTrips.length > 0 && (
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        setMoveOpen(true)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <ArrowRight className="h-4 w-4" />
                      Move to...
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      setDeleteOpen(true)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Expandable details */}
          {details && Object.keys(details).length > 0 && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-3 flex items-center gap-1 text-sm text-[#4f46e5] hover:text-[#4338ca]"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Show details
                  </>
                )}
              </button>

              {expanded && (
                <div className="mt-3">
                  {item.kind === 'flight' && (
                    <FlightDetailsView details={details as FlightDetails} />
                  )}
                  {item.kind === 'hotel' && (
                    <HotelDetailsView details={details as HotelDetails} />
                  )}
                  {item.kind === 'train' && (
                    <TrainDetailsView details={details as TrainDetails} />
                  )}
                  {item.kind === 'car' && (
                    <CarDetailsView details={details as CarRentalDetails} />
                  )}
                  {!['flight', 'hotel', 'train', 'car'].includes(item.kind) && (
                    <GenericDetailsView details={details as Record<string, Json>} />
                  )}
                </div>
              )}
            </>
          )}

          {/* Travelers */}
          {item.traveler_names && item.traveler_names.length > 0 && (
            <div className="mt-3 text-sm text-gray-600">
              <span className="font-medium">Travelers:</span>{' '}
              {item.traveler_names.join(', ')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Move dialog */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Item</DialogTitle>
            <DialogDescription>
              Move this item to a different trip.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={moveTarget}
              onChange={(e) => setMoveTarget(e.target.value)}
            >
              <option value="">Select a trip...</option>
              {otherTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)} disabled={moving}>
              Cancel
            </Button>
            <Button onClick={handleMove} disabled={!moveTarget || moving}>
              {moving ? 'Moving...' : 'Move Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
