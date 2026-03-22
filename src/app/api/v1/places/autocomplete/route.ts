import { NextRequest, NextResponse } from 'next/server'
import { requireSessionAuth, isSessionAuthError } from '@/lib/api/session-auth'

interface PlacePrediction {
  description: string
  placeId: string
  mainText: string
}

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

  const query = body.query
  if (typeof query !== 'string' || query.trim().length < 2) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'query must be at least 2 characters.', field: 'query' } },
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

  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify({
      input: query.trim(),
      includedPrimaryTypes: ['(cities)'],
    }),
  })

  if (!res.ok) {
    console.error('[places/autocomplete] Google API error:', res.status, await res.text())
    return NextResponse.json(
      { error: { code: 'upstream_error', message: 'Failed to fetch predictions.' } },
      { status: 502 }
    )
  }

  const data = await res.json() as {
    suggestions?: Array<{
      placePrediction?: {
        placeId: string
        text?: { text: string }
        structuredFormat?: { mainText?: { text: string } }
      }
    }>
  }

  const predictions: PlacePrediction[] = (data.suggestions ?? [])
    .map((suggestion) => {
      const pp = suggestion.placePrediction
      if (!pp) return null
      return {
        description: pp.text?.text ?? '',
        placeId: pp.placeId,
        mainText: pp.structuredFormat?.mainText?.text ?? pp.text?.text ?? '',
      }
    })
    .filter((p): p is PlacePrediction => p !== null)

  return NextResponse.json({ predictions })
}
