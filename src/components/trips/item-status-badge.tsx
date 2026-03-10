'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn, formatTime } from '@/lib/utils'

type LiveStatus =
  | 'on_time'
  | 'delayed'
  | 'cancelled'
  | 'diverted'
  | 'en_route'
  | 'boarding'
  | 'landed'
  | 'arrived'
  | 'unknown'

export interface StatusPayload {
  status: LiveStatus
  delay_minutes: number | null
  gate: string | null
  terminal: string | null
  estimated_departure: string | null
  previous_status: LiveStatus | null
  last_checked_at: string | null
}

interface ItemStatusBadgeProps {
  itemId: string
  /** The departure time shown on the card (from booking data), e.g. "10:40" */
  scheduledDeparture?: string | null
  /** The item's start_ts in UTC (ISO string), used to derive local timezone offset */
  startTs?: string | null
  /** Called when live status data is fetched, so parent can pass terminal/gate to details */
  onStatusUpdate?: (payload: StatusPayload) => void
}

const STATUS_META: Record<LiveStatus, { label: string; toneClass: string }> = {
  on_time: { label: 'On time', toneClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  delayed: { label: 'Delayed', toneClass: 'text-amber-700 bg-amber-50 border-amber-200' },
  cancelled: { label: 'Cancelled', toneClass: 'text-red-700 bg-red-50 border-red-200' },
  diverted: { label: 'Diverted', toneClass: 'text-red-700 bg-red-50 border-red-200' },
  en_route: { label: 'En route', toneClass: 'text-blue-700 bg-blue-50 border-blue-200' },
  boarding: { label: 'Boarding', toneClass: 'text-blue-700 bg-blue-50 border-blue-200' },
  landed: { label: 'Landed', toneClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  arrived: { label: 'Arrived', toneClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  unknown: { label: 'Status unknown', toneClass: 'text-gray-700 bg-gray-50 border-gray-200' },
}

function statusDotColor(status: LiveStatus): string {
  if (status === 'on_time' || status === 'arrived' || status === 'landed') return 'bg-emerald-500'
  if (status === 'delayed') return 'bg-amber-500'
  if (status === 'cancelled' || status === 'diverted') return 'bg-red-500'
  if (status === 'en_route' || status === 'boarding') return 'bg-blue-500'
  return 'bg-gray-400'
}

function asStatusPayload(value: unknown): StatusPayload | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const status = row.status
  if (typeof status !== 'string') return null
  if (!(status in STATUS_META)) return null

  const delayMinutes =
    typeof row.delay_minutes === 'number' && Number.isFinite(row.delay_minutes)
      ? row.delay_minutes
      : null

  return {
    status: status as LiveStatus,
    delay_minutes: delayMinutes,
    gate: typeof row.gate === 'string' ? row.gate : null,
    terminal: typeof row.terminal === 'string' ? row.terminal : null,
    estimated_departure: typeof row.estimated_departure === 'string' ? row.estimated_departure : null,
    previous_status: typeof row.previous_status === 'string' && row.previous_status in STATUS_META
      ? (row.previous_status as LiveStatus)
      : null,
    last_checked_at: typeof row.last_checked_at === 'string' ? row.last_checked_at : null,
  }
}

function renderLastChecked(iso: string | null): string {
  if (!iso) return 'Last checked unknown'
  const checked = new Date(iso)
  if (Number.isNaN(checked.getTime())) return 'Last checked unknown'

  const ageMs = Date.now() - checked.getTime()
  if (ageMs < 30_000) return 'Last checked just now'
  return `Last checked ${formatDistanceToNow(checked, { addSuffix: true })}`
}

/**
 * Derive the UTC offset (in ms) of the departure airport from the booking's
 * local time and UTC timestamp.  e.g. local 10:40 + UTC 09:40 → +1h (CET).
 */
function deriveOffsetMs(localTime: string | null | undefined, utcIso: string | null | undefined): number | null {
  if (!localTime || !utcIso) return null
  const m = localTime.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const localMinutes = parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
  const utcDate = new Date(utcIso)
  if (Number.isNaN(utcDate.getTime())) return null
  const utcMinutes = utcDate.getUTCHours() * 60 + utcDate.getUTCMinutes()
  // Handle day boundary (e.g. local 01:00, UTC 23:00 → +2h)
  let diff = localMinutes - utcMinutes
  if (diff < -720) diff += 1440
  if (diff > 720) diff -= 1440
  return diff * 60_000
}

/** Convert a UTC ISO timestamp to local HH:MM using a known offset. */
function toLocalTime(utcIso: string, offsetMs: number): string {
  const d = new Date(utcIso)
  if (Number.isNaN(d.getTime())) return formatTime(utcIso)
  const local = new Date(d.getTime() + offsetMs)
  const h = local.getUTCHours()
  const m = local.getUTCMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

export function ItemStatusBadge({ itemId, scheduledDeparture, startTs, onStatusUpdate }: ItemStatusBadgeProps) {
  const [status, setStatus] = useState<StatusPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/items/${itemId}/status`, { cache: 'no-store' })
      if (!response.ok) return
      const payload = await response.json()
      setStatus(asStatusPayload(payload?.data?.status))
    } finally {
      setLoading(false)
    }
  }, [itemId])

  const refreshStatus = useCallback(async () => {
    setRefreshing(true)
    try {
      const response = await fetch(`/api/v1/items/${itemId}/status/refresh`, {
        method: 'POST',
      })

      if (response.ok) {
        const payload = await response.json()
        setStatus(asStatusPayload(payload?.data?.status))
      } else {
        await loadStatus()
      }
    } finally {
      setRefreshing(false)
    }
  }, [itemId, loadStatus])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (status && onStatusUpdate) onStatusUpdate(status)
  }, [status, onStatusUpdate])

  // No automatic polling — data refreshes only on page load or manual refresh.
  // Background FlightAware calls are eliminated; the refresh endpoint returns
  // cached data if checked within the last 5 minutes.

  // Auto-refresh when there's no cached status — this creates the initial
  // FlightAware lookup. Without this, the badge never appears because
  // there's no cached row yet and the refresh button isn't visible.
  // Auto-refresh when no real status exists (null or 'unknown').
  // The GET /status endpoint returns { status: 'unknown' } when there's no
  // cached row — that's truthy, so we must check the inner status field.
  const hasTriggeredAutoRefresh = useRef(false)
  const needsRefresh = !status || status.status === 'unknown'
  useEffect(() => {
    if (!loading && needsRefresh && !hasTriggeredAutoRefresh.current) {
      hasTriggeredAutoRefresh.current = true
      void refreshStatus()
    }
  }, [loading, needsRefresh, refreshStatus])

  // Don't show badge until we have actual status data from FlightAware
  if (loading || refreshing) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Checking flight status…
      </div>
    )
  }

  if (!status || status.status === 'unknown') {
    return null
  }

  const effective = status

  const baseLabel = STATUS_META[effective.status].label
  const offsetMs = deriveOffsetMs(scheduledDeparture, startTs)
  const estimatedTime = effective.estimated_departure
    ? (offsetMs !== null ? toLocalTime(effective.estimated_departure, offsetMs) : formatTime(effective.estimated_departure))
    : null

  let heading: string
  if (effective.status === 'delayed' && (effective.delay_minutes ?? 0) > 0) {
    if (estimatedTime && scheduledDeparture && estimatedTime !== scheduledDeparture) {
      // Live data differs from booking — show the update clearly
      heading = `${baseLabel} · Now departing ${estimatedTime}`
    } else if (estimatedTime) {
      heading = `${baseLabel} ${effective.delay_minutes} min · New departure ${estimatedTime}`
    } else {
      heading = `${baseLabel} ${effective.delay_minutes} min`
    }
  } else if (effective.status === 'on_time' && estimatedTime && scheduledDeparture && estimatedTime !== scheduledDeparture) {
    // Schedule changed but still "on time" per airline — show updated time
    heading = `${baseLabel} · Departure updated to ${estimatedTime}`
  } else {
    heading = baseLabel
  }

  const previousText = effective.previous_status
    ? `(was ${STATUS_META[effective.previous_status].label.toLowerCase()})`
    : null

  const locationBits = [effective.gate ? `Gate ${effective.gate}` : null, effective.terminal ? `Terminal ${effective.terminal}` : null]
    .filter((value): value is string => !!value)
    .join(' · ')

  return (
    <div
      className={cn(
        'mt-3 rounded-md border px-3 py-2',
        STATUS_META[effective.status].toneClass
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            <span className={cn('mr-2 inline-block h-2.5 w-2.5 rounded-full', statusDotColor(effective.status))} />
            {heading} {previousText}
            {effective.status !== 'delayed' && locationBits ? ` · ${locationBits}` : ''}
          </p>
          <p className="mt-0.5 text-xs opacity-90">
            {effective.status === 'delayed' && locationBits ? `${locationBits} · ` : ''}
            {loading ? 'Checking live status…' : renderLastChecked(effective.last_checked_at)}
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => void refreshStatus()}
          disabled={refreshing}
          title="Refresh status"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
        </Button>
      </div>
    </div>
  )
}
