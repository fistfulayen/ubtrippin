'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Share2,
  Trash2,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { buildFlightIdent } from '@/lib/flight-ident'
import { buildFlightPageUrl } from '@/lib/flight-ident'
import { getProviderLogoUrl } from '@/lib/images/provider-logo'
import { cn, extractLocalTime, formatLocalTime, getLocalTimes } from '@/lib/utils'
import type { FlightDetails, Json, Trip, TripItem } from '@/types/database'

import { useFlightStatus, type StatusPayload } from './item-status-badge'

interface FlightItemCardProps {
  item: TripItem
  allTrips: Pick<Trip, 'id' | 'title' | 'start_date'>[]
  currentUserId?: string
  readOnly?: boolean
  metaChips?: ReactNode
  defaultExpanded?: boolean
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

function isWithin48Hours(item: { start_ts?: string | null; start_date?: string | null; end_ts?: string | null }): boolean {
  const now = Date.now()
  const h48 = 48 * 60 * 60 * 1000

  const dep = item.start_ts ? new Date(item.start_ts).getTime()
    : item.start_date ? new Date(`${item.start_date}T00:00:00Z`).getTime()
    : null

  if (!dep || Number.isNaN(dep)) return false

  const endTime = item.end_ts ? new Date(item.end_ts).getTime() : dep + 24 * 60 * 60 * 1000
  return now >= dep - h48 && now <= endTime
}

function deriveOffsetMs(localTime: string | null | undefined, utcIso: string | null | undefined): number | null {
  if (!localTime || !utcIso) return null
  const match = localTime.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null

  const localMinutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
  const utcDate = new Date(utcIso)
  if (Number.isNaN(utcDate.getTime())) return null

  const utcMinutes = utcDate.getUTCHours() * 60 + utcDate.getUTCMinutes()
  let diff = localMinutes - utcMinutes
  if (diff < -720) diff += 1440
  if (diff > 720) diff -= 1440
  return diff * 60_000
}

function toLocalTime(utcIso: string, offsetMs: number): string | null {
  const date = new Date(utcIso)
  if (Number.isNaN(date.getTime())) return null
  const local = new Date(date.getTime() + offsetMs)
  const hours = local.getUTCHours().toString().padStart(2, '0')
  const minutes = local.getUTCMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

function toStatusDisplayTime(
  value: string | null | undefined,
  referenceLocalTime: string | null | undefined,
  referenceUtcIso: string | null | undefined
): string | null {
  if (!value) return null
  const offsetMs = deriveOffsetMs(referenceLocalTime, referenceUtcIso)
  const localTime = offsetMs !== null ? toLocalTime(value, offsetMs) : null
  return formatLocalTime(localTime ?? value)
}

function formatAirportMeta(terminal: string | null | undefined, gate: string | null | undefined): string | null {
  const bits = [
    terminal ? `Terminal ${terminal}` : null,
    gate ? `Gate ${gate}` : null,
  ].filter((value): value is string => !!value)

  return bits.length > 0 ? bits.join(' · ') : null
}

function toRecentLanded(status: StatusPayload | null): boolean {
  if (!status || (status.status !== 'landed' && status.status !== 'arrived')) return false
  const landedAt = status.actual_in ?? status.actual_on ?? status.actual_arrival
  if (!landedAt) return false
  const landedMs = new Date(landedAt).getTime()
  if (Number.isNaN(landedMs)) return false
  return Date.now() - landedMs <= 6 * 60 * 60 * 1000
}

function getBanner(status: StatusPayload | null, showBanner: boolean, arrivalCode: string | null) {
  if (!showBanner || !status || status.status === 'unknown') return null

  if (status.status === 'delayed') {
    return {
      className: 'bg-amber-500 text-white',
      label: `Delayed${status.delay_minutes ? ` · ${status.delay_minutes} min` : ''}`,
    }
  }

  if (status.status === 'boarding') {
    return { className: 'bg-indigo-600 text-white', label: 'Boarding' }
  }

  if (status.status === 'en_route') {
    const eta = status.estimated_arrival
    return {
      className: 'bg-blue-600 text-white',
      label: eta ? `In Flight · ETA ${eta}` : 'In Flight',
    }
  }

  if (status.status === 'landed' || status.status === 'arrived') {
    const landedAt = status.actual_in ?? status.actual_on ?? status.actual_arrival
    return {
      className: 'bg-green-600 text-white',
      label: landedAt ? `Landed at ${landedAt}` : 'Landed',
    }
  }

  if (status.status === 'cancelled') {
    return { className: 'bg-red-600 text-white', label: 'Cancelled' }
  }

  if (status.status === 'diverted') {
    return {
      className: 'bg-red-600 text-white',
      label: arrivalCode ? `Diverted to ${arrivalCode}` : 'Diverted',
    }
  }

  return { className: 'bg-indigo-600 text-white', label: 'On Time' }
}

export function FlightItemCard({
  item,
  allTrips,
  currentUserId,
  readOnly = false,
  metaChips,
  defaultExpanded,
}: FlightItemCardProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [moving, setMoving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [moveTarget, setMoveTarget] = useState<string>('')
  const [newTripName, setNewTripName] = useState<string>('')
  const [logoError, setLogoError] = useState(false)

  const details =
    item.details_json && typeof item.details_json === 'object' && !Array.isArray(item.details_json)
      ? (item.details_json as Record<string, Json>)
      : null
  const flightDetails = (details ?? {}) as FlightDetails & Record<string, unknown>
  const safeAllTrips = Array.isArray(allTrips) ? allTrips : []
  const otherTrips = safeAllTrips.filter((trip) => trip.id !== item.trip_id)
  const isMyItem = !currentUserId || item.user_id === currentUserId
  const sourceEmailId = isMyItem && typeof item.source_email_id === 'string' && item.source_email_id.length > 0
    ? item.source_email_id
    : null
  const providerLogoUrl = item.provider ? getProviderLogoUrl(item.provider, 'flight') : null
  const loyalty = loyaltyChip(item.loyalty_flag)
  const flightPagePath = buildFlightPageUrl(details as Record<string, unknown>, item.start_date)
  const flightIdent = buildFlightIdent(details as Record<string, unknown>) ?? flightDetails.flight_number ?? 'Flight'
  const rawDepartureLocal = typeof flightDetails.departure_local_time === 'string'
    ? flightDetails.departure_local_time
    : extractLocalTime(item.start_ts)
  const rawArrivalLocal = typeof flightDetails.arrival_local_time === 'string'
    ? flightDetails.arrival_local_time
    : extractLocalTime(item.end_ts)
  const [scheduledDepartureDisplay, scheduledArrivalDisplay] = getLocalTimes({
    start_ts: item.start_ts,
    end_ts: item.end_ts,
    details: details as Record<string, unknown> | null,
  })
  const liveEligible = isWithin48Hours(item)
  const {
    status: liveStatus,
    loading: statusLoading,
    refreshing: statusRefreshing,
    refreshStatus,
  } = useFlightStatus({
    itemId: item.id,
    autoRefreshOnUnknown: liveEligible,
  })

  const departureTerminal = liveStatus?.departure_terminal ?? flightDetails.departure_terminal ?? null
  const departureGate = liveStatus?.departure_gate ?? flightDetails.departure_gate ?? null
  const arrivalTerminal = liveStatus?.arrival_terminal ?? flightDetails.arrival_terminal ?? null
  const arrivalGate = liveStatus?.arrival_gate ?? flightDetails.arrival_gate ?? null
  const baggageClaim = liveStatus?.baggage_claim ?? null

  const departureEstimatedDisplay = toStatusDisplayTime(
    liveStatus?.estimated_departure,
    rawDepartureLocal,
    item.start_ts
  )
  const arrivalEstimatedDisplay = toStatusDisplayTime(
    liveStatus?.estimated_arrival,
    rawArrivalLocal,
    item.end_ts
  )
  const departureActualDisplay = toStatusDisplayTime(
    liveStatus?.actual_out ?? liveStatus?.actual_off ?? liveStatus?.actual_departure,
    rawDepartureLocal,
    item.start_ts
  )
  const arrivalActualDisplay = toStatusDisplayTime(
    liveStatus?.actual_in ?? liveStatus?.actual_on ?? liveStatus?.actual_arrival,
    rawArrivalLocal,
    item.end_ts
  )
  const inboundEstimatedDisplay = toStatusDisplayTime(
    liveStatus?.inbound_estimated_in,
    rawDepartureLocal,
    item.start_ts
  )
  const showBanner = liveEligible || toRecentLanded(liveStatus)
  const arrivalCode = flightDetails.arrival_airport ?? item.end_location ?? null
  const banner = getBanner(
    liveStatus
      ? {
          ...liveStatus,
          estimated_arrival: arrivalEstimatedDisplay,
          actual_in: arrivalActualDisplay,
          actual_on: arrivalActualDisplay,
          actual_arrival: arrivalActualDisplay,
        }
      : null,
    showBanner,
    typeof arrivalCode === 'string' ? arrivalCode : null
  )

  const handleDelete = async () => {
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('trip_items').delete().eq('id', item.id)
    setDeleteOpen(false)
    fetch(`/api/v1/trips/${item.trip_id}/rename`, { method: 'POST' }).catch(() => {})
    router.refresh()
  }

  const handleShareFlight = async () => {
    if (!flightPagePath) return
    const url = `https://www.ubtrippin.xyz${flightPagePath}`

    try {
      if (navigator.share) {
        await navigator.share({ title: item.summary ?? flightIdent, url })
      } else {
        await navigator.clipboard.writeText(url)
      }
    } catch {
      // Ignore cancelled share and clipboard failures.
    }
  }

  const handleMove = async () => {
    if (!moveTarget && moveTarget !== '__new__') return
    setMoving(true)

    let targetTripId = moveTarget
    if (moveTarget === '__new__') {
      const title = newTripName.trim() || 'Untitled Trip'
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setMoving(false)
        return
      }

      const { data: newTrip, error } = await supabase
        .from('trips')
        .insert({
          user_id: user.id,
          title,
          start_date: item.start_date ?? null,
          end_date: item.end_date ?? null,
        })
        .select('id')
        .single()

      if (error || !newTrip) {
        setMoving(false)
        return
      }

      targetTripId = newTrip.id
    }

    const supabase = createClient()
    await supabase.from('trip_items').update({ trip_id: targetTripId }).eq('id', item.id)
    setMoveOpen(false)
    await Promise.all([
      fetch(`/api/v1/trips/${item.trip_id}/rename`, { method: 'POST' }).catch(() => {}),
      fetch(`/api/v1/trips/${targetTripId}/rename`, { method: 'POST' }).catch(() => {}),
      fetch(`/api/v1/trips/${targetTripId}/auto-cover`, { method: 'POST' }).catch(() => {}),
    ])
    router.refresh()
  }

  // Compute gate-to-gate duration
  const durationLabel = (() => {
    const depIso = item.start_ts
    const arrIso = item.end_ts
    if (!depIso || !arrIso) return null
    const diffMs = new Date(arrIso).getTime() - new Date(depIso).getTime()
    if (diffMs <= 0 || isNaN(diffMs)) return null
    const totalMin = Math.round(diffMs / 60000)
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  })()

  const departureMeta = formatAirportMeta(departureTerminal, departureGate)
  const arrivalMeta = baggageClaim && (liveStatus?.status === 'landed' || liveStatus?.status === 'arrived')
    ? `Baggage Claim ${baggageClaim}`
    : formatAirportMeta(arrivalTerminal, arrivalGate)

  const departureTime = (() => {
    if (departureActualDisplay && (liveStatus?.status === 'en_route' || liveStatus?.status === 'landed' || liveStatus?.status === 'arrived')) {
      return {
        label: 'Actual',
        primary: departureActualDisplay,
        primaryClass: 'text-green-600',
        secondary: null,
      }
    }
    if (liveStatus?.status === 'delayed' && departureEstimatedDisplay && departureEstimatedDisplay !== scheduledDepartureDisplay) {
      return {
        label: 'Estimated',
        primary: departureEstimatedDisplay,
        primaryClass: 'text-red-600',
        secondary: scheduledDepartureDisplay,
      }
    }
    return {
      label: 'Scheduled',
      primary: scheduledDepartureDisplay,
      primaryClass: 'text-gray-900',
      secondary: null,
    }
  })()

  const arrivalTime = (() => {
    if (arrivalActualDisplay && (liveStatus?.status === 'landed' || liveStatus?.status === 'arrived')) {
      return {
        label: 'Actual',
        primary: arrivalActualDisplay,
        primaryClass: 'text-green-600',
        secondary: null,
      }
    }
    if (
      arrivalEstimatedDisplay &&
      (liveStatus?.status === 'delayed' || liveStatus?.status === 'en_route') &&
      arrivalEstimatedDisplay !== scheduledArrivalDisplay
    ) {
      return {
        label: liveStatus?.status === 'en_route' ? 'ETA' : 'Estimated',
        primary: arrivalEstimatedDisplay,
        primaryClass: liveStatus?.status === 'en_route' ? 'text-indigo-600' : 'text-red-600',
        secondary: scheduledArrivalDisplay,
      }
    }
    return {
      label: 'Scheduled',
      primary: scheduledArrivalDisplay,
      primaryClass: 'text-gray-900',
      secondary: null,
    }
  })()

  const operatedBy = liveStatus?.operator && liveStatus.operator.toLowerCase() !== (item.provider ?? '').toLowerCase()
    ? liveStatus.operator
    : null
  const inboundPath = liveStatus?.inbound_ident && item.start_date
    ? `/flights/${liveStatus.inbound_ident}/${item.start_date}`
    : null

  return (
    <>
      <Card
        className={cn(
          'overflow-hidden rounded-2xl border-gray-200 bg-gray-50 shadow-sm',
          item.needs_review && 'border-yellow-300 bg-yellow-50/60',
          liveStatus?.status === 'cancelled' && 'opacity-60'
        )}
      >
        {banner ? (
          <div className={cn('flex items-center justify-between px-4 py-2 text-sm font-semibold rounded-t-2xl', banner.className)}>
            <span>{banner.label}</span>
            {(statusLoading || statusRefreshing) && <RefreshCw className="h-4 w-4 animate-spin" />}
          </div>
        ) : null}

        <CardContent className="p-0">
          <div className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {providerLogoUrl && !logoError ? (
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white overflow-hidden">
                      <Image
                        src={providerLogoUrl}
                        alt={item.provider || 'Airline'}
                        width={24}
                        height={24}
                        className="object-contain"
                        onError={() => setLogoError(true)}
                      />
                    </span>
                  ) : null}
                  <span className="truncate">{item.provider || flightDetails.airline || 'Airline'}</span>
                  {item.needs_review ? (
                    <Badge variant="warning" className="text-[11px]">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Review
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                  {flightPagePath ? (
                    <Link
                      href={flightPagePath}
                      className="text-lg font-bold text-indigo-600 hover:underline"
                      target="_blank"
                    >
                      {flightIdent}
                    </Link>
                  ) : (
                    <span className="text-lg font-bold text-gray-900">{flightIdent}</span>
                  )}
                  {loyalty ? (
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', loyalty.className)}>
                      {loyalty.text}
                    </span>
                  ) : null}
                  {metaChips}
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                {item.confirmation_code ? (
                  <span className="font-mono text-sm text-gray-600">{item.confirmation_code}</span>
                ) : null}

                {!readOnly ? (
                  <div className="relative flex items-center gap-1">
                    {sourceEmailId ? (
                      <Link href={`/inbox/${sourceEmailId}`}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Edit extraction in Inbox">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-300" disabled title="No source email for this item">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}

                    {liveEligible ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => void refreshStatus()}
                        title="Refresh live status"
                        disabled={statusRefreshing}
                      >
                        <RefreshCw className={cn('h-4 w-4', statusRefreshing && 'animate-spin')} />
                      </Button>
                    ) : null}

                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleShareFlight} title="Share flight link">
                      <Share2 className="h-4 w-4" />
                    </Button>

                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setMenuOpen(!menuOpen)}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>

                    {menuOpen ? (
                      <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border bg-white py-1 shadow-lg">
                        <button
                          onClick={() => {
                            setMenuOpen(false)
                            setMoveOpen(true)
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Move to...
                        </button>
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
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 rounded-2xl bg-white p-4">
              <div className="min-w-0">
                <p className="text-2xl font-bold text-gray-900">{flightDetails.departure_airport ?? 'DEP'}</p>
                <p className="mt-1 truncate text-sm text-gray-500">{item.start_location ?? 'Departure'}</p>
                {departureMeta ? (
                  <p className="mt-2 text-xs font-medium text-gray-500">{departureMeta}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={cn('text-xl font-semibold', departureTime.primaryClass)}>{departureTime.primary}</span>
                  {departureTime.secondary ? (
                    <span className="text-sm text-gray-400 line-through">{departureTime.secondary}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">{departureTime.label}</p>
              </div>

              <div className="flex flex-col items-center pt-6 gap-1">
                <span className="text-lg font-semibold text-indigo-600">→</span>
                {durationLabel && (
                  <span className="text-xs text-gray-400 whitespace-nowrap">{durationLabel}</span>
                )}
              </div>

              <div className="min-w-0 text-right">
                <p className="text-2xl font-bold text-gray-900">{flightDetails.arrival_airport ?? 'ARR'}</p>
                <p className="mt-1 truncate text-sm text-gray-500">{item.end_location ?? 'Arrival'}</p>
                {arrivalMeta ? (
                  <p className={cn(
                    'mt-2 text-xs font-medium',
                    baggageClaim && (liveStatus?.status === 'landed' || liveStatus?.status === 'arrived')
                      ? 'text-green-600'
                      : 'text-gray-500'
                  )}>
                    {arrivalMeta}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  {arrivalTime.secondary ? (
                    <span className="text-sm text-gray-400 line-through">{arrivalTime.secondary}</span>
                  ) : null}
                  <span className={cn('text-xl font-semibold', arrivalTime.primaryClass)}>{arrivalTime.primary}</span>
                </div>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">{arrivalTime.label}</p>
              </div>
            </div>

            {Array.isArray(item.traveler_names) && item.traveler_names.length > 0 ? (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Travelers:</span>{' '}
                {item.traveler_names.join(', ')}
              </div>
            ) : null}

            <div className="border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
              >
                {expanded ? 'Show Less' : 'Show Details'}
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {expanded ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Aircraft & Performance</p>
                    <dl className="mt-3 space-y-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-gray-500">Aircraft</dt>
                        <dd className="text-right font-medium text-gray-900">
                          {liveStatus?.aircraft_type ?? flightDetails.aircraft_type ?? 'Unknown'}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-gray-500">Registration</dt>
                        <dd className="text-right font-medium text-gray-900">{liveStatus?.tail_number ?? 'Unknown'}</dd>
                      </div>
                      {operatedBy ? (
                        <div className="flex items-start justify-between gap-3">
                          <dt className="text-gray-500">Operator</dt>
                          <dd className="text-right font-medium text-gray-900">Operated by {operatedBy}</dd>
                        </div>
                      ) : null}
                      {liveStatus?.codeshares && liveStatus.codeshares.length > 0 ? (
                        <div className="flex items-start justify-between gap-3">
                          <dt className="text-gray-500">Codeshares</dt>
                          <dd className="text-right font-medium text-gray-900">{liveStatus.codeshares.join(', ')}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>

                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Operations</p>
                    <div className="mt-3 space-y-3 text-sm text-gray-600">
                      {liveStatus?.inbound_origin || liveStatus?.inbound_ident ? (
                        <div>
                          <p className="font-medium text-gray-900">
                            Your plane is arriving from {liveStatus.inbound_origin ?? 'another airport'}
                            {liveStatus.inbound_ident ? ` as ${liveStatus.inbound_ident}` : ''}
                          </p>
                          {inboundEstimatedDisplay ? (
                            <p className="mt-1">Inbound ETA {inboundEstimatedDisplay}</p>
                          ) : null}
                          {inboundPath ? (
                            <Link href={inboundPath} className="mt-2 inline-flex text-indigo-600 hover:underline" target="_blank">
                              Track inbound flight
                            </Link>
                          ) : null}
                        </div>
                      ) : (
                        <p>No inbound aircraft data available yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!readOnly && moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Item</DialogTitle>
            <DialogDescription>
              Move this item to a different trip or create a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Select value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)}>
              <option value="">Select a trip...</option>
              <option value="__new__">+ New trip</option>
              {otherTrips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title}
                </option>
              ))}
            </Select>
            {moveTarget === '__new__' ? (
              <input
                type="text"
                value={newTripName}
                onChange={(event) => setNewTripName(event.target.value)}
                placeholder="Trip name (optional — we'll auto-name it)"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#4f46e5] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
              />
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)} disabled={moving}>
              Cancel
            </Button>
            <Button onClick={handleMove} disabled={!moveTarget || moving}>
              {moving ? 'Moving...' : moveTarget === '__new__' ? 'Create & Move' : 'Move Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!readOnly && deleteOpen} onOpenChange={setDeleteOpen}>
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
