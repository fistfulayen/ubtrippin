/**
 * GET /api/v1/items — Search trip items across all accessible trips
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { sanitizeItem } from '@/lib/api/sanitize'
import { createUserScopedClient } from '@/lib/supabase/user-scoped'

const ITEM_SELECT = `id,
       trip_id,
       kind,
       provider,
       summary,
       start_date,
       end_date,
       start_ts,
       end_ts,
       start_location,
       end_location,
       details_json,
       status,
       created_at,
       updated_at,
       trip:trips!inner(title)`

const VALID_ITEM_KINDS = new Set([
  'flight',
  'hotel',
  'car_rental',
  'train',
  'activity',
  'restaurant',
  'ticket',
  'other',
])

function isValidIsoDate(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}

function parsePositiveInt(
  rawValue: string | null,
  field: 'limit' | 'offset',
  defaultValue: number
): { value: number } | { error: NextResponse } {
  if (rawValue === null) return { value: defaultValue }
  if (!/^\d+$/.test(rawValue)) {
    return {
      error: NextResponse.json(
        { error: { code: 'invalid_param', message: `"${field}" must be a non-negative integer.` } },
        { status: 400 }
      ),
    }
  }

  const value = Number.parseInt(rawValue, 10)
  if (!Number.isSafeInteger(value) || value < 0) {
    return {
      error: NextResponse.json(
        { error: { code: 'invalid_param', message: `"${field}" must be a non-negative integer.` } },
        { status: 400 }
      ),
    }
  }

  return { value }
}

type SharedTripRow = {
  trip: Array<{
    id: string
    title: string
  }>
}

type ItemRow = Record<string, unknown> & {
  trip: Array<{
    title: string
  }>
}

export async function GET(request: NextRequest) {
  // 1. Authenticate
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  // 2. Rate limit
  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const searchParams = request.nextUrl.searchParams
  const date = searchParams.get('date')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const kind = searchParams.get('kind')

  if (date && (from || to)) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_param',
          message: 'Use either "date" or "from"/"to", not both.',
        },
      },
      { status: 400 }
    )
  }

  for (const [field, value] of [
    ['date', date],
    ['from', from],
    ['to', to],
  ] as const) {
    if (value !== null && !isValidIsoDate(value)) {
      return NextResponse.json(
        {
          error: {
            code: 'invalid_param',
            message: `"${field}" must be a valid ISO date (YYYY-MM-DD).`,
          },
        },
        { status: 400 }
      )
    }
  }

  if (from && to && from > to) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_param',
          message: '"from" must be less than or equal to "to".',
        },
      },
      { status: 400 }
    )
  }

  if (kind !== null && !VALID_ITEM_KINDS.has(kind)) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_param',
          message:
            '"kind" must be one of: flight, hotel, car_rental, train, activity, restaurant, ticket, other.',
        },
      },
      { status: 400 }
    )
  }

  const parsedLimit = parsePositiveInt(searchParams.get('limit'), 'limit', 50)
  if ('error' in parsedLimit) return parsedLimit.error
  if (parsedLimit.value < 1 || parsedLimit.value > 200) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_param',
          message: '"limit" must be between 1 and 200.',
        },
      },
      { status: 400 }
    )
  }
  const limit = parsedLimit.value

  const parsedOffset = parsePositiveInt(searchParams.get('offset'), 'offset', 0)
  if ('error' in parsedOffset) return parsedOffset.error
  const offset = parsedOffset.value

  const supabase = await createUserScopedClient(auth.userId)

  // 3a. Fetch owned trips
  const { data: ownedTrips, error: ownedError } = await supabase
    .from('trips')
    .select('id, title')
    .eq('user_id', auth.userId)

  if (ownedError) {
    console.error('[v1/items] Supabase error (owned trips):', ownedError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch items.' } },
      { status: 500 }
    )
  }

  // 3b. Fetch shared trips (collaborator, accepted)
  const { data: sharedCollabs, error: sharedError } = await supabase
    .from('trip_collaborators')
    .select('trip:trips!inner(id, title)')
    .eq('user_id', auth.userId)
    .not('accepted_at', 'is', null)

  if (sharedError) {
    console.error('[v1/items] Supabase error (shared trips):', sharedError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch items.' } },
      { status: 500 }
    )
  }

  const tripMap = new Map<string, string>()
  for (const trip of ownedTrips ?? []) {
    tripMap.set(trip.id, trip.title)
  }
  for (const collab of (sharedCollabs ?? []) as SharedTripRow[]) {
    const trip = collab.trip[0]
    if (trip) {
      tripMap.set(trip.id, trip.title)
    }
  }

  const tripIds = [...tripMap.keys()]
  if (tripIds.length === 0) {
    return NextResponse.json({
      data: [],
      meta: { count: 0, limit, offset },
    })
  }

  // 4. Fetch filtered items
  let query = supabase
    .from('trip_items')
    .select(ITEM_SELECT, { count: 'exact' })
    .in('trip_id', tripIds)
    .order('start_date', { ascending: true, nullsFirst: false })
    .order('start_ts', { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (kind) {
    query = query.eq('kind', kind)
  }

  if (date) {
    query = query
      .lte('start_date', date)
      .or(`end_date.gte.${date},and(end_date.is.null,start_date.eq.${date})`)
  } else {
    if (to) {
      query = query.lte('start_date', to)
    }
    if (from) {
      query = query.or(`end_date.gte.${from},and(end_date.is.null,start_date.gte.${from})`)
    }
  }

  const { data: items, error: itemsError, count } = await query

  if (itemsError) {
    console.error('[v1/items] Supabase error (items):', itemsError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch items.' } },
      { status: 500 }
    )
  }

  const sanitized = (items ?? []).map((item) => {
    const row = item as ItemRow
    const { trip, ...flat } = row
    const tripRow = trip[0]
    return sanitizeItem({
      ...flat,
      trip_title: tripRow?.title ?? tripMap.get(String(row.trip_id ?? '')) ?? null,
    })
  })

  return NextResponse.json({
    data: sanitized,
    meta: { count: count ?? 0, limit, offset },
  })
}
