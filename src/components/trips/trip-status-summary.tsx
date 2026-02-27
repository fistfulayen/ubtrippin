'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

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

interface TripStatusSummaryProps {
  tripId: string
  enabled: boolean
}

interface SummaryState {
  label: string
  className: string
}

function asStatusRows(value: unknown): Array<{ status: LiveStatus }> {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const status = (entry as Record<string, unknown>).status
      if (
        status === 'on_time' ||
        status === 'delayed' ||
        status === 'cancelled' ||
        status === 'diverted' ||
        status === 'en_route' ||
        status === 'boarding' ||
        status === 'landed' ||
        status === 'arrived' ||
        status === 'unknown'
      ) {
        return { status }
      }
      return null
    })
    .filter((row): row is { status: LiveStatus } => row !== null)
}

function summarize(rows: Array<{ status: LiveStatus }>): SummaryState | null {
  if (rows.length === 0) return null

  const cancelledCount = rows.filter((row) => row.status === 'cancelled' || row.status === 'diverted').length
  if (cancelledCount > 0) {
    return {
      label: `${cancelledCount} cancelled`,
      className: 'bg-red-100 text-red-700',
    }
  }

  const delayedCount = rows.filter((row) => row.status === 'delayed').length
  if (delayedCount > 0) {
    return {
      label: delayedCount === 1 ? '1 delay' : `${delayedCount} delays`,
      className: 'bg-amber-100 text-amber-700',
    }
  }

  const healthyStatuses = new Set<LiveStatus>(['on_time', 'arrived', 'landed', 'en_route', 'boarding'])
  if (rows.every((row) => healthyStatuses.has(row.status))) {
    return {
      label: 'All on time',
      className: 'bg-emerald-100 text-emerald-700',
    }
  }

  return null
}

export function TripStatusSummary({ tripId, enabled }: TripStatusSummaryProps) {
  const [rows, setRows] = useState<Array<{ status: LiveStatus }>>([])

  const load = useCallback(async () => {
    if (!enabled) {
      setRows([])
      return
    }

    const response = await fetch(`/api/v1/trips/${tripId}/status`, { cache: 'no-store' })
    if (!response.ok) return
    const payload = await response.json()
    setRows(asStatusRows(payload?.data))
  }, [enabled, tripId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load()
      }
    }, 2 * 60 * 1000)

    return () => clearInterval(timer)
  }, [enabled, load])

  const summary = useMemo(() => summarize(rows), [rows])
  if (!enabled || !summary) return null

  return (
    <span
      className={cn(
        'mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        summary.className
      )}
    >
      {summary.label}
    </span>
  )
}
