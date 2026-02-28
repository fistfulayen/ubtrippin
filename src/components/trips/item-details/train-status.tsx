'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

import { cn } from '@/lib/utils'

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
  platform: string | null
  last_checked_at: string | null
}

interface TrainStatusBadgeProps {
  itemId: string
}

const STATUS_META: Record<LiveStatus, { label: string; toneClass: string }> = {
  on_time: { label: 'On time', toneClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  delayed: { label: 'Delayed', toneClass: 'text-amber-700 bg-amber-50 border-amber-200' },
  cancelled: { label: 'Cancelled', toneClass: 'text-red-700 bg-red-50 border-red-200' },
  diverted: { label: 'Diverted', toneClass: 'text-red-700 bg-red-50 border-red-200' },
  en_route: { label: 'En route', toneClass: 'text-blue-700 bg-blue-50 border-blue-200' },
  boarding: { label: 'Boarding', toneClass: 'text-blue-700 bg-blue-50 border-blue-200' },
  landed: { label: 'Arrived', toneClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  arrived: { label: 'Arrived', toneClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  unknown: { label: 'Status unavailable', toneClass: 'text-gray-700 bg-gray-50 border-gray-200' },
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
    platform: typeof row.platform === 'string' ? row.platform : null,
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

export function TrainStatusBadge({ itemId }: TrainStatusBadgeProps) {
  const [status, setStatus] = useState<StatusPayload | null>(null)
  const [loading, setLoading] = useState(true)

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

  if (!status) return null

  const heading = useMemo(() => {
    const base = STATUS_META[status.status].label
    if (status.status === 'delayed' && (status.delay_minutes ?? 0) > 0) {
      return `${base} ${status.delay_minutes} min`
    }
    return base
  }, [status.delay_minutes, status.status])

  return (
    <div
      className={cn(
        'mt-3 rounded-md border px-3 py-2',
        STATUS_META[status.status].toneClass
      )}
    >
      <p className="text-sm font-medium">
        <span className={cn('mr-2 inline-block h-2.5 w-2.5 rounded-full', statusDotColor(status.status))} />
        {heading}
        {status.platform ? ` · Platform ${status.platform}` : ''}
      </p>
      <p className="mt-0.5 text-xs opacity-90">
        {loading ? 'Checking live status…' : renderLastChecked(status.last_checked_at)}
      </p>
    </div>
  )
}
