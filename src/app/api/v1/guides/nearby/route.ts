/**
 * GET /api/v1/guides/nearby?lat=X&lng=Y&radius=5
 *
 * Return guide entries within `radius` km of the given coordinates.
 * Only returns entries from the authenticated user's guides.
 *
 * Requires the earthdistance + cube postgres extensions (enabled in migration).
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createSecretClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')
  const radiusKm = parseFloat(searchParams.get('radius') ?? '5')

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: '"lat" and "lng" are required numeric parameters.' } },
      { status: 400 }
    )
  }

  const radiusMeters = radiusKm * 1000

  const supabase = createSecretClient()

  // Use earth_distance via RPC — requires earthdistance extension
  // We filter by user_id in the guides join, so only the user's entries are returned
  const { data, error } = await supabase.rpc('guides_nearby', {
    p_user_id: auth.userId,
    p_lat: lat,
    p_lng: lng,
    p_radius_m: radiusMeters,
  })

  if (error) {
    // Graceful fallback: earthdistance RPC may not exist yet (pre-migration)
    // Fall back to returning entries sorted by approximate distance
    console.error('[v1/guides/nearby] RPC error, falling back:', error.message)

    const { data: allEntries, error: fallbackError } = await supabase
      .from('guide_entries')
      .select(`
        *,
        city_guides!inner(city, country, country_code)
      `)
      .eq('user_id', auth.userId)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)

    if (fallbackError) {
      return NextResponse.json(
        { error: { code: 'internal_error', message: 'Failed to fetch nearby entries.' } },
        { status: 500 }
      )
    }

    // Haversine in JS as fallback
    const withDist = (allEntries ?? [])
      .map((e: Record<string, unknown>) => ({
        ...e,
        distance_m: haversineMeters(lat, lng, e.latitude as number, e.longitude as number),
      }))
      .filter((e) => e.distance_m <= radiusMeters)
      .sort((a, b) => a.distance_m - b.distance_m)

    return NextResponse.json({
      data: withDist,
      meta: { count: withDist.length, lat, lng, radius_km: radiusKm },
    })
  }

  return NextResponse.json({
    data: data ?? [],
    meta: { count: (data ?? []).length, lat, lng, radius_km: radiusKm },
  })
}

/** Haversine formula — distance in meters between two lat/lng pairs */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000 // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
