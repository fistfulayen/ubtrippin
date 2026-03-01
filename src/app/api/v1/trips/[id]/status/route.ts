import { NextResponse } from 'next/server'

import { extractFlightIdentFromDetails, normalizeStatusRow } from '@/lib/flight-status'
import { extractTrainNumberFromItem } from '@/lib/train/sncf'
import { requireSessionAuth, isSessionAuthError } from '@/lib/api/session-auth'
import { isValidUUID } from '@/lib/validation'

interface StatusItemRow {
  id: string
  trip_id: string | null
  kind: string
  start_date: string
  end_date: string | null
  start_ts: string | null
  end_ts: string | null
  provider: string | null
  summary: string | null
  details_json: Record<string, unknown> | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params
  if (!isValidUUID(tripId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Trip ID must be a valid UUID.' } },
      { status: 400 }
    )
  }

  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  const { data: trip } = await auth.supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .maybeSingle()

  if (!trip) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Trip not found.' } },
      { status: 404 }
    )
  }

  const { data: itemRows, error: itemError } = await auth.supabase
    .from('trip_items')
    .select('id, trip_id, kind, start_date, end_date, start_ts, end_ts, provider, summary, details_json')
    .eq('trip_id', tripId)
    .in('kind', ['flight', 'train'])
    .order('start_date', { ascending: true })
    .order('start_ts', { ascending: true })

  if (itemError) {
    console.error('[v1/trips/:id/status GET] item query failed:', itemError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch trip statuses.' } },
      { status: 500 }
    )
  }

  const items = (itemRows ?? []) as StatusItemRow[]
  const itemIds = items.map((item) => item.id)

  const { data: statusRows, error: statusError } = itemIds.length
    ? await auth.supabase
        .from('trip_item_status')
        .select('item_id, status, delay_minutes, gate, terminal, platform, estimated_departure, estimated_arrival, actual_departure, actual_arrival, source, last_checked_at, status_changed_at, previous_status, raw_response')
        .in('item_id', itemIds)
    : { data: [], error: null }

  if (statusError) {
    console.error('[v1/trips/:id/status GET] status query failed:', statusError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch trip statuses.' } },
      { status: 500 }
    )
  }

  const statusByItemId = new Map<string, Record<string, unknown>>(
    ((statusRows ?? []) as Array<Record<string, unknown>>).map((row) => [row.item_id as string, row])
  )

  const data = items.map((item) => {
    const normalized = normalizeStatusRow(item.id, statusByItemId.get(item.id))
    // Exclude heavy raw payload on collection endpoint.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { raw_response, ...status } = normalized

    return {
      ...status,
      trip_id: item.trip_id,
      start_date: item.start_date,
      end_date: item.end_date,
      start_ts: item.start_ts,
      end_ts: item.end_ts,
      provider: item.provider,
      summary: item.summary,
      kind: item.kind,
      flight_number: extractFlightIdentFromDetails(item.details_json),
      train_number: extractTrainNumberFromItem({
        details_json: item.details_json,
        summary: item.summary,
        provider: item.provider,
      }),
    }
  })

  return NextResponse.json({
    data,
    meta: { count: data.length },
  })
}
