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

export async function geocodeCity(query: string): Promise<GeocodeResult | null> {
  const key = query.trim().toLowerCase()
  if (!key) return null
  if (cache.has(key)) return cache.get(key) ?? null

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', query)
  url.searchParams.set('count', '5')
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')

  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Geocoding failed with status ${response.status}`)
  }

  const payload = (await response.json()) as OpenMeteoGeocodeResponse
  const best = payload.results?.sort((a, b) => scoreResult(query, b) - scoreResult(query, a))[0] ?? null
  const result = best
    ? {
        city: best.name,
        latitude: best.latitude,
        longitude: best.longitude,
        country: best.country ?? null,
        admin1: best.admin1 ?? null,
      }
    : null

  cache.set(key, result)
  return result
}

export function clearGeocodeCache() {
  cache.clear()
}
