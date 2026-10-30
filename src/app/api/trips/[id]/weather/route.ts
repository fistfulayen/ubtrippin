import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { isSessionAuthError, requireSessionAuth } from '@/lib/api/session-auth'
import { canRefreshWeather, getTripWeather } from '@/lib/weather/service'
import type { TemperatureUnit } from '@/lib/weather/types'
import { resolveTripReadAccess, resolveTripWriteAccess } from '@/lib/trips/access'
import { isValidUUID } from '@/lib/validation'

async function authorizeTrip(auth: Awaited<ReturnType<typeof requireSessionAuth>>, id: string, write: boolean) {
  if (isSessionAuthError(auth)) return auth
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: { code: 'invalid_param', message: 'Invalid trip ID.' } }, { status: 400 })
  }
  // API-key fallback uses a service client; RLS alone cannot authorize this route.
  const access = await (write ? resolveTripWriteAccess : resolveTripReadAccess)({
    supabase: auth.supabase, tripId: id, userId: auth.userId,
  })
  if (access.allowed) return null
  const status = access.reason === 'internal_error' ? 500 : access.reason === 'not_found' ? 404 : 403
  return NextResponse.json({ error: { code: status === 500 ? 'internal_error' : status === 404 ? 'not_found' : 'forbidden', message: 'Trip is not accessible.' } }, { status })
}

function parseUnit(value: string | null): TemperatureUnit | undefined {
  if (value === 'celsius') return 'celsius'
  if (value === 'fahrenheit') return 'fahrenheit'
  return undefined
}

async function getOwnerPlan(tripId: string, supabase: SupabaseClient<Database>) {
  const { data: trip } = await supabase
    .from('trips')
    .select('user_id')
    .eq('id', tripId)
    .maybeSingle()
  const tripRow = trip as { user_id?: string } | null

  if (!tripRow?.user_id) return 'free'

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', tripRow.user_id)
    .maybeSingle()
  const profileRow = profile as { subscription_tier?: string | null } | null

  return profileRow?.subscription_tier === 'pro' ? 'pro' : 'free'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  const { id } = await params
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true'
  const denied = await authorizeTrip(auth, id, forceRefresh)
  if (denied) return denied
  const ownerPlan = await getOwnerPlan(id, auth.supabase)
  const payload = await getTripWeather({
    tripId: id,
    supabase: auth.supabase,
    userId: auth.userId,
    requestedUnit: parseUnit(request.nextUrl.searchParams.get('unit')),
    forceRefresh,
    includePacking: ownerPlan === 'pro',
  })

  if (!payload) {
    return NextResponse.json({ error: { code: 'not_found', message: 'Trip not found.' } }, { status: 404 })
  }

  return NextResponse.json(payload)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  const { id } = await params
  const denied = await authorizeTrip(auth, id, true)
  if (denied) return denied
  const key = `${auth.userId}:${id}:weather-refresh`
  const rate = checkRateLimit(key)
  if (!rate.allowed || rate.remaining < 99) {
    const { data: cacheRow } = await auth.supabase
      .from('trip_weather_cache')
      .select('fetched_at')
      .eq('trip_id', id)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!canRefreshWeather(cacheRow?.fetched_at ?? null)) {
      return NextResponse.json(
        { error: { code: 'rate_limited', message: 'Weather can be refreshed once per minute per trip.' } },
        { status: 429 }
      )
    }
  }

  const ownerPlan = await getOwnerPlan(id, auth.supabase)
  const payload = await getTripWeather({
    tripId: id,
    supabase: auth.supabase,
    userId: auth.userId,
    requestedUnit: parseUnit(request.nextUrl.searchParams.get('unit')),
    forceRefresh: true,
    includePacking: ownerPlan === 'pro',
  })

  if (!payload) {
    return NextResponse.json({ error: { code: 'not_found', message: 'Trip not found.' } }, { status: 404 })
  }

  return NextResponse.json(payload)
}
