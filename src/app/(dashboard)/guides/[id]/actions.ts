'use server'

import { createClient } from '@/lib/supabase/server'

const GOOGLE_PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchText'
const MAX_QUERY_LENGTH = 120
const MAX_CITY_LENGTH = 100

interface PlaceSuggestion {
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  google_place_id: string | null
  website_url: string | null
}

function cleanInput(value: string, maxLength: number): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

export async function searchPlaces(query: string, city: string): Promise<PlaceSuggestion[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const cleanedQuery = cleanInput(query, MAX_QUERY_LENGTH)
  const cleanedCity = cleanInput(city, MAX_CITY_LENGTH)
  if (!cleanedQuery || !cleanedCity) return []

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    console.warn('GOOGLE_PLACES_API_KEY not configured')
    return []
  }

  try {
    const response = await fetch(GOOGLE_PLACES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName.text,places.formattedAddress,places.location,places.websiteUri',
      },
      body: JSON.stringify({
        textQuery: `${cleanedQuery} in ${cleanedCity}`,
        languageCode: 'en',
        maxResultCount: 6,
      }),
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('[guides/searchPlaces] Google Places API error:', response.status)
      return []
    }

    const data = (await response.json()) as {
      places?: Array<{
        id?: string
        displayName?: { text?: string }
        formattedAddress?: string
        location?: { latitude?: number; longitude?: number }
        websiteUri?: string
      }>
    }

    return (data.places ?? [])
      .map((place) => ({
        name: place.displayName?.text?.trim() ?? '',
        address: place.formattedAddress?.trim() ?? null,
        latitude:
          typeof place.location?.latitude === 'number' ? place.location.latitude : null,
        longitude:
          typeof place.location?.longitude === 'number' ? place.location.longitude : null,
        google_place_id: place.id?.trim() ?? null,
        website_url: place.websiteUri?.trim() ?? null,
      }))
      .filter((place) => place.name.length > 0)
  } catch (error) {
    console.error('[guides/searchPlaces] Failed:', error)
    return []
  }
}
