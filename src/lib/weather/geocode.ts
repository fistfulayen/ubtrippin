import type { GeocodeResult } from './types'

const cache = new Map<string, GeocodeResult | null>()

interface OpenMeteoGeocodeResponse {
  results?: Array<{
    name: string
    latitude: number
    longitude: number
    country?: string
    admin1?: string
    population?: number
  }>
}

function scoreResult(query: string, result: NonNullable<OpenMeteoGeocodeResponse['results']>[number]) {
  const normalizedQuery = query.toLowerCase()
  let score = result.population ?? 0
  if (normalizedQuery.includes(result.name.toLowerCase())) score += 100000000
  if (result.admin1 && normalizedQuery.includes(result.admin1.toLowerCase())) score += 10000000
  if (result.country && normalizedQuery.includes(result.country.toLowerCase())) score += 1000000
  return score
}

async function geocodeSingle(query: string): Promise<GeocodeResult | null> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', query)
  url.searchParams.set('count', '5')
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')

  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    // Throw on HTTP errors so transient failures don't trigger fallback logic
    // (which could geocode the wrong city)
    throw new Error(`Geocoding failed with status ${response.status}`)
  }

  const payload = (await response.json()) as OpenMeteoGeocodeResponse
  const best = payload.results?.sort((a, b) => scoreResult(query, b) - scoreResult(query, a))[0] ?? null
  return best
    ? {
        city: best.name,
        latitude: best.latitude,
        longitude: best.longitude,
        country: best.country ?? null,
        admin1: best.admin1 ?? null,
      }
    : null
}

export async function geocodeCity(query: string): Promise<GeocodeResult | null> {
  const key = query.trim().toLowerCase()
  if (!key) return null
  if (cache.has(key)) return cache.get(key) ?? null

  try {
    // Try the full query first
    const result = await geocodeSingle(query)
    if (result) {
      cache.set(key, result)
      return result
    }

    // For small towns the geocoder doesn't know (e.g. "Surfside, Florida"),
    // try just the first part ("Surfside") which may match with lower population
    if (query.includes(',')) {
      const parts = query.split(',').map((p) => p.trim()).filter(Boolean)
      if (parts.length >= 2) {
        const fallback = await geocodeSingle(parts[0])
        if (fallback) {
          // Cache under the fallback key too, not the original — prevents
          // a "Paris, TX" lookup caching France's coords under "paris, tx"
          cache.set(parts[0].toLowerCase(), fallback)
          cache.set(key, fallback)
          return fallback
        }
      }
    }

    cache.set(key, null)
    return null
  } catch {
    // HTTP errors (429, 500, 503) — don't cache, don't fallback
    return null
  }
}

export function clearGeocodeCache() {
  cache.clear()
}
