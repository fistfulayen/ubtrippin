import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { checkRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'
import { isAuthError, validateApiKey } from '@/lib/api/auth'
import { createUserScopedClient } from '@/lib/supabase/user-scoped'
import { canRefreshWeather, getTripWeather } from '@/lib/weather/service'
import type { TemperatureUnit } from '@/lib/weather/types'

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
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const { id } = await params
  const supabase = await createUserScopedClient(auth.userId)
  const ownerPlan = await getOwnerPlan(id, supabase)
  const payload = await getTripWeather({
    tripId: id,
    supabase,
    userId: auth.userId,
    requestedUnit: parseUnit(request.nextUrl.searchParams.get('unit')),
    forceRefresh: request.nextUrl.searchParams.get('refresh') === 'true',
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
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const { id } = await params
  const supabase = await createUserScopedClient(auth.userId)
  const rate = checkRateLimit(`${auth.keyHash}:${id}:weather-refresh`)
  if (!rate.allowed || rate.remaining < 99) {
    const { data: cacheRow } = await supabase
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

  const ownerPlan = await getOwnerPlan(id, supabase)
  const payload = await getTripWeather({
    tripId: id,
    supabase,
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
