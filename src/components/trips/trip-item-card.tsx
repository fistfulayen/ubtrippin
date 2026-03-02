'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { getLocalTimes, cn } from '@/lib/utils'
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
  Pencil,
} from 'lucide-react'
import type { TripItem, Trip, FlightDetails, HotelDetails, TrainDetails, CarRentalDetails, Json } from '@/types/database'
import { getProviderLogoUrl } from '@/lib/images/provider-logo'
import {
  FlightDetailsView,
  HotelDetailsView,
  TrainDetailsView,
  TrainStatusBadge,
  CarDetailsView,
  GenericDetailsView,
} from './item-details'
import { ItemStatusBadge } from './item-status-badge'

interface TripItemCardProps {
  item: TripItem
  allTrips: Pick<Trip, 'id' | 'title' | 'start_date'>[]
  currentUserId?: string
}

function loyaltyChip(loyaltyFlag: unknown): { text: string; className: string } | null {
  if (!loyaltyFlag || typeof loyaltyFlag !== 'object') return null
  const flag = loyaltyFlag as Record<string, unknown>
  const status = typeof flag.status === 'string' ? flag.status : null
  const program = typeof flag.program === 'string'
    ? flag.program
    : typeof flag.provider_name === 'string'
    ? flag.provider_name
    : 'Loyalty'

  if (status === 'missing_from_booking') {
    return {
      text: `${program} not in booking - check?`,
      className: 'bg-amber-100 text-amber-800',
    }
  }

  if (status === 'compatible_available') {
    return {
      text: `${program} available for this booking`,
      className: 'bg-blue-100 text-blue-800',
    }
  }

  if (status === 'applied') {
    return {
      text: `${program} applied`,
      className: 'bg-emerald-100 text-emerald-800',
    }
  }

  return null
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


function isWithin48Hours(item: { start_ts?: string | null; start_date?: string | null; end_ts?: string | null }): boolean {
  const now = Date.now()
  const h48 = 48 * 60 * 60 * 1000

  // If the item has already ended, don't show status
  if (item.end_ts) {
    const end = new Date(item.end_ts).getTime()
    if (end < now) return false
  }

  // Check if departure is within the next 48 hours
  const dep = item.start_ts ? new Date(item.start_ts).getTime()
    : item.start_date ? new Date(item.start_date + 'T00:00:00Z').getTime()
    : null

  if (!dep) return false

  // Show status: from 48h before departure until end (or departure + 24h if no end)
  const endTime = item.end_ts ? new Date(item.end_ts).getTime() : dep + 24 * 60 * 60 * 1000
  return now >= dep - h48 && now <= endTime
}

export function TripItemCard({ item, allTrips, currentUserId }: TripItemCardProps) {
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
  const details =
    item.details_json && typeof item.details_json === 'object' && !Array.isArray(item.details_json)
      ? (item.details_json as Record<string, Json>)
      : null
  const providerLogoUrl = item.provider
    ? getProviderLogoUrl(item.provider, item.kind)
    : null
  const loyalty = loyaltyChip(item.loyalty_flag)

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

  const safeAllTrips = Array.isArray(allTrips) ? allTrips : []
  const otherTrips = safeAllTrips.filter((t) => t.id !== item.trip_id)
  const isMyItem = !currentUserId || item.user_id === currentUserId
  const sourceEmailId = isMyItem && typeof item.source_email_id === 'string' && item.source_email_id.length > 0
    ? item.source_email_id
    : null

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
            {providerLogoUrl && !logoError ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white border border-gray-200 overflow-hidden">
                <Image
                  src={providerLogoUrl}
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

              {/* Title: hotel name for hotels, provider/summary for others */}
              <h4 className="mt-1 font-semibold text-gray-900">
                {(item.kind === 'hotel' && typeof details?.hotel_name === 'string' && details.hotel_name)
                  || item.summary || item.provider || 'Untitled'}
              </h4>
              {item.kind === 'hotel' && typeof details?.hotel_name === 'string' && details.hotel_name && item.provider && (
                <p className="text-xs text-gray-500">{item.provider}{item.confirmation_code ? ` · ${item.confirmation_code}` : ''}</p>
              )}

              {loyalty && (
                <div className="mt-1.5">
                  <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', loyalty.className)}>
                    {loyalty.text}
                  </span>
                </div>
              )}

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

              {item.kind === 'flight' && isWithin48Hours(item) && (
                <ItemStatusBadge itemId={item.id} />
              )}

              {item.kind === 'train' && isWithin48Hours(item) && (
                <TrainStatusBadge itemId={item.id} />
              )}
            </div>

            {/* Actions */}
            <div className="relative flex items-center gap-1">
              {sourceEmailId ? (
                <Link href={`/inbox/${sourceEmailId}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Edit extraction in Inbox"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-300"
                  disabled
                  title="No source email for this item"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}

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
                    <GenericDetailsView details={details} />
                  )}
                </div>
              )}
            </>
          )}

          {/* Travelers */}
          {Array.isArray(item.traveler_names) && item.traveler_names.length > 0 && (
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
