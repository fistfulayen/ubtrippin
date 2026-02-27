import { NextRequest, NextResponse } from 'next/server'

import {
  buildFlightLookup,
  buildStatusUpsertValues,
  getFlightStatus,
  normalizeStatusRow,
  type ExistingTripItemStatus,
} from '@/lib/flight-status'
import { createSecretClient } from '@/lib/supabase/service'
import { dispatchWebhookEvent } from '@/lib/webhooks'

export const dynamic = 'force-dynamic'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DEFAULT_FLIGHT_DURATION_MS = 6 * HOUR_MS

interface FlightItemRow {
  id: string
  trip_id: string | null
  user_id: string
  start_date: string
  end_date: string | null
  start_ts: string | null
  end_ts: string | null
  provider: string | null
  summary: string | null
  details_json: Record<string, unknown> | null
}

interface ExistingStatusRow extends ExistingTripItemStatus {
  item_id: string
  last_checked_at: string | null
  estimated_departure: string | null
  estimated_arrival: string | null
  actual_departure: string | null
  actual_arrival: string | null
}

interface TripRow {
  id: string
  user_id: string
  title: string
  primary_location: string | null
}

function parseIso(value: string | null | undefined): Date | null {
  if (!value) return null
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) return null
  return new Date(ms)
}

function parseDateOnly(date: string | null, endOfDay = false): Date | null {
  if (!date) return null
  const suffix = endOfDay ? 'T23:59:59Z' : 'T00:00:00Z'
  const ms = Date.parse(`${date}${suffix}`)
  if (Number.isNaN(ms)) return null
  return new Date(ms)
}

function resolveDepartureTime(item: FlightItemRow, existing: ExistingStatusRow | undefined): Date | null {
  return (
    parseIso(existing?.actual_departure) ||
    parseIso(existing?.estimated_departure) ||
    parseIso(item.start_ts) ||
    parseDateOnly(item.start_date)
  )
}

function resolveArrivalTime(
  item: FlightItemRow,
  existing: ExistingStatusRow | undefined,
  departureAt: Date | null
): Date | null {
  const direct =
    parseIso(existing?.actual_arrival) ||
    parseIso(existing?.estimated_arrival) ||
    parseIso(item.end_ts) ||
    parseDateOnly(item.end_date, true)

  if (direct) return direct
  if (!departureAt) return null
  return new Date(departureAt.getTime() + DEFAULT_FLIGHT_DURATION_MS)
}

function isStaleForSchedule(
  now: Date,
  item: FlightItemRow,
  existing: ExistingStatusRow | undefined
): boolean {
  const lastCheckedAt = parseIso(existing?.last_checked_at)
  const departureAt = resolveDepartureTime(item, existing)
  const arrivalAt = resolveArrivalTime(item, existing, departureAt)

  if (!departureAt) {
    return !lastCheckedAt || now.getTime() - lastCheckedAt.getTime() >= 2 * HOUR_MS
  }

  if (arrivalAt && now >= arrivalAt) {
    if (!lastCheckedAt) return true
    return lastCheckedAt < arrivalAt
  }

  if (now >= departureAt) {
    return !lastCheckedAt || now.getTime() - lastCheckedAt.getTime() >= 15 * MINUTE_MS
  }

  const msUntilDeparture = departureAt.getTime() - now.getTime()
  let thresholdMs = 8 * HOUR_MS
  if (msUntilDeparture <= 4 * HOUR_MS) {
    thresholdMs = 30 * MINUTE_MS
  } else if (msUntilDeparture <= 24 * HOUR_MS) {
    thresholdMs = 2 * HOUR_MS
  }

  return !lastCheckedAt || now.getTime() - lastCheckedAt.getTime() >= thresholdMs
}

function hasValidCronAuth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[internal/status-check] CRON_SECRET is not configured. Denying access for security.')
    return false
  }
  return request.headers.get('authorization') === `Bearer ${secret}`
}

async function processStatusChecks() {
  const supabase = createSecretClient()
  const now = new Date()
  const minDate = new Date(now.getTime() - 48 * HOUR_MS).toISOString().slice(0, 10)
  const maxDate = new Date(now.getTime() + 48 * HOUR_MS).toISOString().slice(0, 10)

  const { data: itemRows, error: itemError } = await supabase
    .from('trip_items')
    .select('id, trip_id, user_id, start_date, end_date, start_ts, end_ts, provider, summary, details_json')
    .eq('kind', 'flight')
    .gte('start_date', minDate)
    .lte('start_date', maxDate)
    .order('start_date', { ascending: true })

  if (itemError) {
    throw new Error(`Failed to load flight items: ${itemError.message}`)
  }

  const items = (itemRows ?? []) as FlightItemRow[]
  if (items.length === 0) {
    return {
      eligible: 0,
      stale: 0,
      checked: 0,
      changed: 0,
      skipped: 0,
      failed: 0,
    }
  }

  const itemIds = items.map((item) => item.id)
  const { data: existingRows } = await supabase
    .from('trip_item_status')
    .select(`
      item_id,
      status,
      previous_status,
      status_changed_at,
      last_checked_at,
      estimated_departure,
      estimated_arrival,
      actual_departure,
      actual_arrival
    `)
    .in('item_id', itemIds)

  const existingByItemId = new Map<string, ExistingStatusRow>(
    ((existingRows ?? []) as ExistingStatusRow[]).map((row) => [row.item_id, row])
  )

  const tripIds = Array.from(new Set(items.map((item) => item.trip_id).filter((id): id is string => !!id)))
  const { data: tripRows } = tripIds.length
    ? await supabase
        .from('trips')
        .select('id, user_id, title, primary_location')
        .in('id', tripIds)
    : { data: [] as unknown[] }

  const tripById = new Map<string, TripRow>(
    ((tripRows ?? []) as TripRow[]).map((trip) => [trip.id, trip])
  )

  let staleCount = 0
  let checkedCount = 0
  let changedCount = 0
  let skippedCount = 0
  let failedCount = 0

  for (const item of items) {
    const existing = existingByItemId.get(item.id)
    if (!isStaleForSchedule(now, item, existing)) {
      skippedCount += 1
      continue
    }
    staleCount += 1

    const lookup = buildFlightLookup({
      start_date: item.start_date,
      details_json: item.details_json,
    })
    if (!lookup) {
      skippedCount += 1
      continue
    }

    const result = await getFlightStatus(lookup.ident, lookup.date)
    if (!result) {
      failedCount += 1
      continue
    }

    const upsert = buildStatusUpsertValues({
      itemId: item.id,
      result,
      existing: existing ?? null,
    })

    const { data: upserted, error: upsertError } = await supabase
      .from('trip_item_status')
      .upsert(upsert.values, { onConflict: 'item_id' })
      .select('*')
      .single()

    if (upsertError || !upserted) {
      console.error('[internal/status-check] upsert failed:', upsertError)
      failedCount += 1
      continue
    }

    checkedCount += 1

    if (upsert.statusChanged && item.trip_id) {
      changedCount += 1
      const trip = tripById.get(item.trip_id)

      void dispatchWebhookEvent({
        userId: trip?.user_id ?? item.user_id,
        tripId: item.trip_id,
        event: 'item.status_changed',
        data: {
          trip: trip
            ? {
                id: trip.id,
                title: trip.title,
                primary_location: trip.primary_location,
              }
            : { id: item.trip_id },
          item: {
            id: item.id,
            trip_id: item.trip_id,
            provider: item.provider,
            summary: item.summary,
            start_date: item.start_date,
            end_date: item.end_date,
          },
          status: normalizeStatusRow(item.id, upserted as Record<string, unknown>),
          previous_status: upsert.previousStatus,
        },
      }).catch((error) => {
        console.error('[webhooks] item.status_changed dispatch failed:', error)
      })
    }
  }

  return {
    eligible: items.length,
    stale: staleCount,
    checked: checkedCount,
    changed: changedCount,
    skipped: skippedCount,
    failed: failedCount,
  }
}

async function handleRequest(request: NextRequest) {
  if (!hasValidCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const summary = await processStatusChecks()
    return NextResponse.json({ data: summary })
  } catch (error) {
    console.error('[internal/status-check]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return handleRequest(request)
}

export async function GET(request: NextRequest) {
  return handleRequest(request)
}
