import { NextResponse } from 'next/server'

import { extractFlightIdentFromDetails, normalizeStatusRow } from '@/lib/flight-status'
import { createClient } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/validation'

interface FlightItemRow {
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

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required.' } },
      { status: 401 }
    )
  }

  const { data: item, error: itemError } = await supabase
    .from('trip_items')
    .select('id, trip_id, kind, provider, summary, start_date, end_date, start_ts, end_ts, details_json')
    .eq('id', itemId)
    .eq('kind', 'flight')
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
      { error: { code: 'not_found', message: 'Flight item not found.' } },
      { status: 404 }
    )
  }

  const { data: statusRow, error: statusError } = await supabase
    .from('trip_item_status')
    .select('*')
    .eq('item_id', itemId)
    .maybeSingle()

  if (statusError) {
    console.error('[v1/items/:id/status GET] status query failed:', statusError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch item status.' } },
      { status: 500 }
    )
  }

  const flight = item as FlightItemRow

  return NextResponse.json({
    data: {
      item: {
        id: flight.id,
        trip_id: flight.trip_id,
        provider: flight.provider,
        summary: flight.summary,
        start_date: flight.start_date,
        end_date: flight.end_date,
        start_ts: flight.start_ts,
        end_ts: flight.end_ts,
        flight_number: extractFlightIdentFromDetails(flight.details_json),
      },
      status: normalizeStatusRow(itemId, statusRow as Record<string, unknown> | null),
    },
  })
}
