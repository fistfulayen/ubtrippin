/**
 * POST /api/v1/trips/:id/rename
 *
 * Re-generates the trip title based on current items.
 * Called after item deletion/move to keep titles accurate.
 * Works with both cookie auth (web UI) and API key auth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSecretClient } from '@/lib/supabase/service'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { generateTripName } from '@/lib/trips/naming'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params

  // Try API key auth first, fall back to cookie auth
  let userId: string | null = null

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const auth = await validateApiKey(request)
    if (isAuthError(auth)) return auth
    userId = auth.userId
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  }

  if (!userId) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const supabase = createSecretClient()

  // Verify trip ownership
  const { data: trip } = await supabase
    .from('trips')
    .select('id, title')
    .eq('id', tripId)
    .eq('user_id', userId)
    .single()

  if (!trip) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Trip not found' } },
      { status: 404 }
    )
  }

  // Get remaining items
  const { data: items } = await supabase
    .from('trip_items')
    .select('kind, start_location, end_location, start_date, end_date, provider, summary, traveler_names')
    .eq('trip_id', tripId)
    .order('start_date', { ascending: true })

  if (!items || items.length === 0) {
    return NextResponse.json({ data: { title: trip.title, renamed: false } })
  }

  const newTitle = await generateTripName(items, trip.title)
  if (newTitle && newTitle !== trip.title) {
    await supabase
      .from('trips')
      .update({ title: newTitle })
      .eq('id', tripId)

    return NextResponse.json({ data: { title: newTitle, renamed: true } })
  }

  return NextResponse.json({ data: { title: trip.title, renamed: false } })
}
