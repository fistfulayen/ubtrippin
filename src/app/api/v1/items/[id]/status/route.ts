import { NextResponse } from 'next/server'

import { extractFlightIdentFromDetails, normalizeStatusRow } from '@/lib/flight-status'
import { extractTrainNumberFromItem } from '@/lib/train/sncf'
import { requireSessionAuth, isSessionAuthError } from '@/lib/api/session-auth'
import { isValidUUID } from '@/lib/validation'

interface StatusItemRow {
  id: string
  trip_id: string | null
  kind: string
  provider: string | null
  summary: string | null
  start_date: string
  end_date: string | null
  start_ts: string | null
  end_ts: string | null
  details_json: Record<string, unknown> | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: itemId } = await params
  if (!isValidUUID(itemId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Item ID must be a valid UUID.' } },
      { status: 400 }
    )
  }

  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  const { data: item, error: itemError } = await auth.supabase
    .from('trip_items')
    .select('id, trip_id, kind, provider, summary, start_date, end_date, start_ts, end_ts, details_json')
    .eq('id', itemId)
    .in('kind', ['flight', 'train'])
    .maybeSingle()

  if (itemError) {
    console.error('[v1/items/:id/status GET] item query failed:', itemError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch item status.' } },
      { status: 500 }
    )
  }

  if (!item) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Flight or train item not found.' } },
      { status: 404 }
    )
  }

  const { data: statusRow, error: statusError } = await auth.supabase
    .from('trip_item_status')
    .select('item_id, status, delay_minutes, gate, terminal, platform, estimated_departure, estimated_arrival, actual_departure, actual_arrival, source, last_checked_at, status_changed_at, previous_status, raw_response')
    .eq('item_id', itemId)
    .maybeSingle()

  if (statusError) {
    console.error('[v1/items/:id/status GET] status query failed:', statusError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch item status.' } },
      { status: 500 }
    )
  }

  const statusItem = item as StatusItemRow

  return NextResponse.json({
    data: {
      item: {
        id: statusItem.id,
        trip_id: statusItem.trip_id,
        kind: statusItem.kind,
        provider: statusItem.provider,
        summary: statusItem.summary,
        start_date: statusItem.start_date,
        end_date: statusItem.end_date,
        start_ts: statusItem.start_ts,
        end_ts: statusItem.end_ts,
        flight_number: extractFlightIdentFromDetails(statusItem.details_json),
        train_number: extractTrainNumberFromItem({
          details_json: statusItem.details_json,
          summary: statusItem.summary,
          provider: statusItem.provider,
        }),
      },
      status: normalizeStatusRow(itemId, statusRow as Record<string, unknown> | null),
    },
  })
}
