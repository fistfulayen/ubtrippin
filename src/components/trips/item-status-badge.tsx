'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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

interface StatusPayload {
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

export function ItemStatusBadge({ itemId }: ItemStatusBadgeProps) {
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
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadStatus()
      }
    }, 2 * 60 * 1000)

    return () => clearInterval(timer)
  }, [loadStatus])

  const effective = status ?? {
    status: 'unknown' as LiveStatus,
    delay_minutes: null,
    gate: null,
    terminal: null,
    estimated_departure: null,
    previous_status: null,
    last_checked_at: null,
  }

  const heading = useMemo(() => {
    const base = STATUS_META[effective.status].label
    if (effective.status === 'delayed' && (effective.delay_minutes ?? 0) > 0) {
      const newDeparture = effective.estimated_departure ? ` · New departure ${formatTime(effective.estimated_departure)}` : ''
      return `${base} ${effective.delay_minutes} min${newDeparture}`
    }
    return base
  }, [effective.delay_minutes, effective.estimated_departure, effective.status])

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
