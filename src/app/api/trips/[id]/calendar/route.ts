import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateTripICal } from '@/lib/calendar/ical'

function sanitizeFileName(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return base || 'trip'
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .single()

  if (tripError || !trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  const { data: items } = await supabase
    .from('trip_items')
    .select('*')
    .eq('trip_id', trip.id)
    .eq('user_id', user.id)
    .order('start_date', { ascending: true })
    .order('start_ts', { ascending: true })

  const ics = generateTripICal(trip, items || [])
  const filename = `${sanitizeFileName(trip.title)}.ics`

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
