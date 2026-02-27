import { NextResponse } from 'next/server'

import {
  buildFlightLookup,
  buildStatusUpsertValues,
  extractFlightIdentFromDetails,
  getFlightStatus,
  normalizeStatusRow,
  type ExistingTripItemStatus,
} from '@/lib/flight-status'
import { createClient } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/validation'
import { dispatchWebhookEvent } from '@/lib/webhooks'

const FREE_DAILY_REFRESH_LIMIT = 3

interface FlightItemRow {
  id: string
  trip_id: string | null
  user_id: string
  provider: string | null
  summary: string | null
  start_date: string
  end_date: string | null
  start_ts: string | null
  end_ts: string | null
  details_json: Record<string, unknown> | null
}

function utcDayStartIso(now = new Date()): string {
  const dayStart = new Date(now)
  dayStart.setUTCHours(0, 0, 0, 0)
  return dayStart.toISOString()
}

export async function POST(
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
    .select('id, trip_id, user_id, provider, summary, start_date, end_date, start_ts, end_ts, details_json')
    .eq('id', itemId)
    .eq('kind', 'flight')
    .maybeSingle()

  if (itemError) {
    console.error('[v1/items/:id/status/refresh POST] item query failed:', itemError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to refresh flight status.' } },
      { status: 500 }
    )
  }

  if (!item) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Flight item not found.' } },
      { status: 404 }
    )
  }

  const flightItem = item as FlightItemRow

  const lookup = buildFlightLookup({
    start_date: flightItem.start_date,
    details_json: flightItem.details_json,
  })
  if (!lookup) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_state',
          message: 'This flight item does not contain a valid flight number for live status lookup.',
        },
      },
      { status: 400 }
    )
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[v1/items/:id/status/refresh POST] profile query failed:', profileError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to refresh flight status.' } },
      { status: 500 }
    )
  }

  const isPro = profileData?.subscription_tier === 'pro'
  let usedToday = 0

  if (!isPro) {
    const { count, error: limitError } = await supabase
      .from('trip_item_status_refresh_logs')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', user.id)
      .gte('created_at', utcDayStartIso())

    if (limitError) {
      console.error('[v1/items/:id/status/refresh POST] limit query failed:', limitError)
      return NextResponse.json(
        { error: { code: 'internal_error', message: 'Failed to refresh flight status.' } },
        { status: 500 }
      )
    }

    usedToday = count ?? 0
    if (usedToday >= FREE_DAILY_REFRESH_LIMIT) {
      return NextResponse.json(
        {
          error: {
            code: 'rate_limited',
            message: 'Free plan allows 3 live status refreshes per day. Upgrade to Pro for unlimited refreshes.',
          },
        },
        { status: 429 }
      )
    }
  }

  const { data: existingStatus } = await supabase
    .from('trip_item_status')
    .select('status, previous_status, status_changed_at')
    .eq('item_id', itemId)
    .maybeSingle()

  const latest = await getFlightStatus(lookup.ident, lookup.date)
  if (!latest) {
    return NextResponse.json(
      { error: { code: 'upstream_error', message: 'FlightAware status lookup failed.' } },
      { status: 502 }
    )
  }

  const upsert = buildStatusUpsertValues({
    itemId,
    result: latest,
    existing: (existingStatus as ExistingTripItemStatus | null) ?? null,
  })

  const { data: savedStatus, error: saveError } = await supabase
    .from('trip_item_status')
    .upsert(upsert.values, { onConflict: 'item_id' })
    .select('*')
    .single()

  if (saveError || !savedStatus) {
    console.error('[v1/items/:id/status/refresh POST] status upsert failed:', saveError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to refresh flight status.' } },
      { status: 500 }
    )
  }

  const { error: logError } = await supabase
    .from('trip_item_status_refresh_logs')
    .insert({
      user_id: user.id,
      item_id: itemId,
    })

  if (logError) {
    console.error('[v1/items/:id/status/refresh POST] refresh log insert failed:', logError)
  }

  if (upsert.statusChanged && flightItem.trip_id) {
    const { data: trip } = await supabase
      .from('trips')
      .select('id, user_id, title, primary_location')
      .eq('id', flightItem.trip_id)
      .maybeSingle()

    if (trip) {
      void dispatchWebhookEvent({
        userId: trip.user_id as string,
        tripId: trip.id as string,
        event: 'item.status_changed',
        data: {
          trip: {
            id: trip.id,
            title: trip.title,
            primary_location: trip.primary_location,
          },
          item: {
            id: flightItem.id,
            trip_id: flightItem.trip_id,
            provider: flightItem.provider,
            summary: flightItem.summary,
            start_date: flightItem.start_date,
            end_date: flightItem.end_date,
            flight_number: extractFlightIdentFromDetails(flightItem.details_json),
          },
          status: normalizeStatusRow(itemId, savedStatus as Record<string, unknown>),
          previous_status: upsert.previousStatus,
        },
      }).catch((error) => {
        console.error('[webhooks] item.status_changed dispatch failed:', error)
      })
    }
  }

  return NextResponse.json({
    data: {
      item: {
        id: flightItem.id,
        trip_id: flightItem.trip_id,
        provider: flightItem.provider,
        summary: flightItem.summary,
        start_date: flightItem.start_date,
        end_date: flightItem.end_date,
        start_ts: flightItem.start_ts,
        end_ts: flightItem.end_ts,
        flight_number: extractFlightIdentFromDetails(flightItem.details_json),
      },
      status: normalizeStatusRow(itemId, savedStatus as Record<string, unknown>),
    },
    meta: {
      subscription_tier: isPro ? 'pro' : 'free',
      refreshes_today: isPro ? null : usedToday + 1,
      remaining_today: isPro ? null : Math.max(0, FREE_DAILY_REFRESH_LIMIT - (usedToday + 1)),
    },
  })
}
