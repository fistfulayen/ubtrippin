import { NextRequest, NextResponse } from 'next/server'
import { requireSessionAuth, isSessionAuthError } from '@/lib/api/session-auth'

export async function POST(request: NextRequest) {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } },
      { status: 400 }
    )
  }

  const { lat, lng } = body
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'lat and lng must be numbers.' } },
      { status: 400 }
    )
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: { code: 'configuration_error', message: 'Places API not configured.' } },
      { status: 500 }
    )
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('latlng', `${lat},${lng}`)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('result_type', 'locality|administrative_area_level_1')

  const res = await fetch(url.toString())
  if (!res.ok) {
    console.error('[places/reverse-geocode] Google API error:', res.status)
    return NextResponse.json(
      { error: { code: 'upstream_error', message: 'Failed to reverse geocode.' } },
      { status: 502 }
    )
  }

  const data = await res.json() as {
    status: string
    results?: Array<{
      address_components: Array<{
        long_name: string
        types: string[]
      }>
    }>
  }

  if (data.status !== 'OK' || !data.results?.length) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Could not determine city from coordinates.' } },
      { status: 404 }
    )
  }

  // Prefer locality (city), fall back to administrative_area_level_1 (state/region)
  let city: string | null = null
  for (const result of data.results) {
    const locality = result.address_components.find((c) => c.types.includes('locality'))
    if (locality) {
      city = locality.long_name
      break
    }
  }
  if (!city) {
    for (const result of data.results) {
      const admin = result.address_components.find((c) =>
        c.types.includes('administrative_area_level_1')
      )
      if (admin) {
        city = admin.long_name
        break
      }
    }
  }

  if (!city) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Could not determine city from coordinates.' } },
      { status: 404 }
    )
  }

  return NextResponse.json({ city })
}
