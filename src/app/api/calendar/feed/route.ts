import { NextRequest, NextResponse } from 'next/server'
import { createSecretClient } from '@/lib/supabase/server'
import { generateFeedICal } from '@/lib/calendar/ical'
import type { Trip, TripItem } from '@/types/database'

function getDateSixMonthsAgo(): string {
  const date = new Date()
  date.setUTCMonth(date.getUTCMonth() - 6)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function computeEtag(trips: Array<{ updated_at: string }>, items: Array<{ updated_at: string }>): string {
  const latestTripUpdate = trips.reduce((latest, trip) => (
    trip.updated_at > latest ? trip.updated_at : latest
  ), '')
  const latestItemUpdate = items.reduce((latest, item) => (
    item.updated_at > latest ? item.updated_at : latest
  ), '')

  const value = `${latestTripUpdate}|${latestItemUpdate}|${trips.length}|${items.length}`
  return `"${Buffer.from(value).toString('base64url')}"`
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim()
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const supabase = createSecretClient()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('calendar_token', token)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  const cutoffDate = getDateSixMonthsAgo()
  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', profile.id)
    .or(`end_date.is.null,end_date.gt.${cutoffDate}`)
    .order('start_date', { ascending: true })

  if (tripsError) {
    return NextResponse.json({ error: 'Failed to fetch trips' }, { status: 500 })
  }

  const tripIds = ((trips || []) as Trip[]).map((trip) => trip.id)
  let items: TripItem[] = []

  if (tripIds.length > 0) {
    const { data: fetchedItems, error: itemsError } = await supabase
      .from('trip_items')
      .select('*')
      .eq('user_id', profile.id)
      .in('trip_id', tripIds)
      .order('start_date', { ascending: true })
      .order('start_ts', { ascending: true })

    if (itemsError) {
      return NextResponse.json({ error: 'Failed to fetch trip items' }, { status: 500 })
    }

    items = (fetchedItems || []) as TripItem[]
  }

  const typedTrips = (trips || []) as Trip[]
  const etag = computeEtag(typedTrips, items)
  const ifNoneMatch = request.headers.get('if-none-match')
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
      },
    })
  }

  const ics = generateFeedICal(typedTrips, items)
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      ETag: etag,
      'Cache-Control': 'private, max-age=60, must-revalidate',
    },
  })
}
