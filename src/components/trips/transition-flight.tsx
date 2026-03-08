'use client'

import { Plane } from 'lucide-react'
import type { TripItem } from '@/types/database'

interface TransitionFlightProps {
  flight: TripItem
  destinationCity: string
}

function formatHoursAndMinutes(totalMinutes: number) {
  const rounded = Math.max(1, Math.round(totalMinutes))
  const hours = Math.floor(rounded / 60)
  const minutes = rounded % 60
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}

function durationLabel(flight: TripItem) {
  const details =
    flight.details_json && typeof flight.details_json === 'object' && !Array.isArray(flight.details_json)
      ? (flight.details_json as Record<string, unknown>)
      : null

  const textDuration =
    (typeof details?.flight_duration === 'string' && details.flight_duration) ||
    (typeof details?.duration === 'string' && details.duration) ||
    (typeof details?.flight_time === 'string' && details.flight_time)

  if (textDuration) return textDuration

  const numericDuration =
    (typeof details?.flight_duration_minutes === 'number' && details.flight_duration_minutes) ||
    (typeof details?.duration_minutes === 'number' && details.duration_minutes) ||
    (typeof details?.flight_time_minutes === 'number' && details.flight_time_minutes)

  if (numericDuration) return formatHoursAndMinutes(numericDuration)
  if (!flight.start_ts || !flight.end_ts) return null

  const start = new Date(flight.start_ts)
  const end = new Date(flight.end_ts)
  const diffMinutes = (end.getTime() - start.getTime()) / (60 * 1000)

  return diffMinutes > 0 ? formatHoursAndMinutes(diffMinutes) : null
}

export function TransitionFlight({ flight, destinationCity }: TransitionFlightProps) {
  const providerLabel = flight.provider ? `${flight.provider} · ` : ''
  const summary = `${providerLabel}Flight to ${destinationCity}`
  const duration = durationLabel(flight)

  return (
    <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/70 px-4 py-3 text-sm text-slate-700">
      <div className="flex items-center gap-2">
        <Plane className="h-4 w-4 text-sky-700" />
        <span className="font-medium text-slate-900">{summary}</span>
        {duration ? <span className="text-slate-500">· {duration}</span> : null}
      </div>
      {(flight.start_location || flight.end_location) ? (
        <p className="mt-1 text-xs text-slate-500">
          {[flight.start_location, flight.end_location].filter(Boolean).join(' -> ')}
        </p>
      ) : null}
    </div>
  )
}
