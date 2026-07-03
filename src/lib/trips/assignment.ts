import type { Trip } from '@/types/database'
import type { ExtractedItem } from '@/lib/ai/extract-travel-data'
import { resolveAirportCity, resolveKnownCityFromText } from './airport-cities'

const GAP_TOLERANCE_DAYS = 1

export interface TripAssignment {
  tripId: string | null // null means create new trip
  tripTitle: string | null // suggested title for new trip
}

export function assignToTrip(
  item: ExtractedItem,
  existingTrips: Pick<Trip, 'id' | 'title' | 'start_date' | 'end_date' | 'primary_location'>[]
): TripAssignment {
  if (existingTrips.length === 0) {
    return {
      tripId: null,
      tripTitle: suggestTripTitle(item),
    }
  }

  const itemStart = new Date(item.start_date)
  const itemEnd = item.end_date ? new Date(item.end_date) : itemStart

  // Find overlapping or adjacent trips
  const candidates = existingTrips.filter((trip) => {
    if (!trip.start_date) return false

    const tripStart = new Date(trip.start_date)
    const tripEnd = trip.end_date ? new Date(trip.end_date) : tripStart

    // Expand trip range by gap tolerance
    const expandedStart = new Date(tripStart)
    expandedStart.setDate(expandedStart.getDate() - GAP_TOLERANCE_DAYS)

    const expandedEnd = new Date(tripEnd)
    expandedEnd.setDate(expandedEnd.getDate() + GAP_TOLERANCE_DAYS)

    // Check for overlap
    return itemStart <= expandedEnd && itemEnd >= expandedStart
  })

  if (candidates.length === 0) {
    return {
      tripId: null,
      tripTitle: suggestTripTitle(item),
    }
  }

  if (candidates.length === 1) {
    return {
      tripId: candidates[0].id,
      tripTitle: null,
    }
  }

  // Multiple candidates: pick the one with closest start date
  const sorted = candidates.sort((a, b) => {
    const distA = Math.abs(
      new Date(a.start_date!).getTime() - itemStart.getTime()
    )
    const distB = Math.abs(
      new Date(b.start_date!).getTime() - itemStart.getTime()
    )
    return distA - distB
  })

  return {
    tripId: sorted[0].id,
    tripTitle: null,
  }
}

function suggestTripTitle(item: ExtractedItem): string {
  const location =
    getPrimaryLocation([item]) ||
    (item.kind !== 'restaurant' ? item.end_location || item.start_location : null)

  // Format the date for the title
  const date = new Date(item.start_date)
  const monthYear = date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })

  if (location) {
    // Clean up location name (remove airport codes if present)
    const cleanLocation = location
      .replace(/\([A-Z]{3}\)/g, '') // Remove (SFO) style
      .replace(/^[A-Z]{3}\s*-?\s*/g, '') // Remove SFO - style
      .trim()

    if (cleanLocation) {
      return `Trip to ${cleanLocation} - ${monthYear}`
    }
  }

  return `Trip - ${monthYear}`
}

export function updateTripDates(
  trip: Pick<Trip, 'start_date' | 'end_date'>,
  item: ExtractedItem
): { start_date: string | null; end_date: string | null } {
  const itemStart = item.start_date
  const itemEnd = item.end_date || item.start_date

  let newStart = trip.start_date
  let newEnd = trip.end_date

  // Expand trip dates if item is outside current range
  if (!newStart || itemStart < newStart) {
    newStart = itemStart
  }

  if (!newEnd || itemEnd > newEnd) {
    newEnd = itemEnd
  }

  return {
    start_date: newStart,
    end_date: newEnd,
  }
}

/**
 * Returns true if the string looks like a venue/hotel name rather than a city.
 *
 * Uses leading articles and hospitality keywords — NOT word count, which incorrectly
 * flags multi-word city names like "New York City", "Salt Lake City", "Mexico City".
 */
export function looksLikeVenueName(name: string): boolean {
  return (
    /^(The|A|An)\s/i.test(name) ||
    /\b(Hotel|Inn|Hostel|Resort|Suites?|Lodge|Motel|Apartments?|Villas?|Palace|House|Gardens|Manor|Hall|Centre|Center|Venue|Club|Restaurant|Cafe|Café|Bar|Bistro|Omakase|Ramen|Sushi)\b/i.test(name)
  )
}

/**
 * Extract a city from a raw location string, or null if it is only a venue name.
 * "Paris CDG" → "Paris", "The Vendue, Charleston, SC" → "Charleston",
 * "New York JFK" → "New York", "New York (JFK)" → "New York",
 * "Tokyo, Japan" → "Tokyo", "Sushi Azabu" → null
 */
export function normaliseToCity(location: string | null | undefined): string | null {
  if (!location) return null
  const extracted = extractCityFromLocation(location, null)
  if (!extracted) return null
  return extracted.split(',')[0].trim()
}

export function isCityLikeLocation(location: string | null | undefined): boolean {
  return normaliseToCity(location) !== null
}

export function recomputeTripPrimaryLocation(
  items: TripLocationSource[],
  currentPrimaryLocation: string | null | undefined = null
): string | null {
  const derived = getPrimaryLocation(items)
  if (derived) return derived
  return isCityLikeLocation(currentPrimaryLocation) ? currentPrimaryLocation!.trim() : null
}

interface TripLocationSource {
  kind: string
  start_location?: string | null
  end_location?: string | null
  details?: Record<string, unknown> | null
  details_json?: Record<string, unknown> | null
}

function getItemDetails(item: TripLocationSource): Record<string, unknown> | null {
  if (item.details && typeof item.details === 'object' && !Array.isArray(item.details)) {
    return item.details
  }
  if (item.details_json && typeof item.details_json === 'object' && !Array.isArray(item.details_json)) {
    return item.details_json
  }
  return null
}

function cityFromAirportCode(location: string | null | undefined): string | null {
  if (!location) return null
  const trimmed = location.trim().toUpperCase()
  if (/^[A-Z]{3}$/.test(trimmed)) {
    return resolveAirportCity(trimmed)?.city ?? null
  }

  const codeInParens = trimmed.match(/\(([A-Z]{3})\)$/)?.[1]
  if (codeInParens) return resolveAirportCity(codeInParens)?.city ?? null

  const codePrefix = trimmed.match(/^([A-Z]{3})\s*[-–]\s*/)?.[1]
  if (codePrefix) return resolveAirportCity(codePrefix)?.city ?? null

  return null
}

function extractCityFromLocation(
  location: string | null | undefined,
  kind: string | null
): string | null {
  if (!location) return null

  const city = location.trim()
  if (!city) return null

  const airportCity = cityFromAirportCode(city)
  if (airportCity) return airportCity

  if (city.includes(',')) {
    const segments = city.split(',').map((segment) => segment.trim()).filter(Boolean)
    if (segments.length > 0) {
      const first = segments[0]
      if (looksLikeVenueName(first) && segments.length >= 2) {
        const second = segments[1]
        const third = segments[2]
        if (second) {
          if (third && third.length <= 24 && !looksLikeVenueName(third)) {
            return `${second}, ${third}`
          }
          return resolveKnownCityFromText(second) || second
        }
        return null
      }

      return city
    }
  }

  if (kind === 'restaurant') {
    return null
  }

  if (looksLikeVenueName(city)) {
    const stripped = city
      .replace(/\b(The|A|An|Hotel|Inn|Hostel|Resort|Suites?|Lodge|Motel|Apartments?|Villas?|Palace|House|Gardens|Manor|Hall|Centre|Center|Venue|Club|Restaurant|Cafe|Café|Bar|Bistro|Omakase|Ramen|Sushi|Grand|Royal|Park|Hyatt|Marriott|Hilton|Sheraton|Westin|Radisson|Novotel|Ibis|Sofitel|Intercontinental|Hampton|Courtyard|Best|Western|Hoshino|OMO)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (stripped) {
      const resolved = resolveKnownCityFromText(stripped)
      if (resolved) return resolved
    }
    return null
  }

  return resolveKnownCityFromText(city) || city
}

function candidateLocationForItem(item: TripLocationSource): string | null {
  const details = getItemDetails(item)
  const detailAddress = typeof details?.address === 'string' ? details.address : null

  if (item.kind === 'flight') {
    return (
      extractCityFromLocation(detailAddress, item.kind) ||
      extractCityFromLocation(item.end_location, item.kind) ||
      extractCityFromLocation(item.start_location, item.kind)
    )
  }

  if (item.kind === 'hotel') {
    return (
      extractCityFromLocation(detailAddress, item.kind) ||
      extractCityFromLocation(item.start_location, item.kind) ||
      extractCityFromLocation(item.end_location, item.kind)
    )
  }

  if (item.kind === 'restaurant') {
    return (
      extractCityFromLocation(detailAddress, item.kind) ||
      extractCityFromLocation(item.end_location, item.kind) ||
      extractCityFromLocation(item.start_location, item.kind)
    )
  }

  return (
    extractCityFromLocation(detailAddress, item.kind) ||
    extractCityFromLocation(item.end_location, item.kind) ||
    extractCityFromLocation(item.start_location, item.kind)
  )
}

/**
 * Derive the primary location for a trip from its items.
 *
 * Priority:
 * 1. Hotel/accommodation city
 * 2. Most-repeated city across all non-flight items (activities, restaurants, trains)
 * 3. Most-repeated flight destination as fallback
 */
export function getPrimaryLocation(items: TripLocationSource[]): string | null {
  const hotelLocations: string[] = []
  const groundLocations: string[] = []
  const flightDests: string[] = []

  for (const item of items) {
    const city = candidateLocationForItem(item)
    if (!city) continue

    if (item.kind === 'hotel') {
      hotelLocations.push(city)
    } else if (item.kind === 'flight') {
      flightDests.push(city)
    } else {
      groundLocations.push(city)
    }
  }

  if (hotelLocations.length > 0) {
    const best = mostFrequentCity(hotelLocations)
    if (best) return best
  }

  if (groundLocations.length > 0) {
    const best = mostFrequentCity(groundLocations)
    if (best) return best
  }

  if (flightDests.length > 0) {
    const best = mostFrequentCity(flightDests)
    if (best) return best
  }

  return null
}

/** Return the most frequent city from a list of location strings. */
function mostFrequentCity(locations: string[]): string | null {
  const counts: Record<string, { count: number; original: string }> = {}

  for (const loc of locations) {
    const city = extractCityFromLocation(loc, null) || loc.trim()
    if (!city) continue
    if (!counts[city]) {
      counts[city] = { count: 0, original: loc }
    }
    counts[city].count++
  }

  const entries = Object.values(counts)
  if (entries.length === 0) return null

  entries.sort((a, b) => b.count - a.count)

  const best = entries[0]
  const orig = best.original
  const normalised = extractCityFromLocation(orig, null) || orig

  // If original is a clean "City, Country" or "City, State" (2 segments, not a venue),
  // prefer it for display. Otherwise use the normalised city.
  const segments = orig.split(',').map((s: string) => s.trim())
  const firstIsCity = segments.length === 2 && !looksLikeVenueName(segments[0])
  if (firstIsCity) {
    return orig
  }
  return normalised
}

/**
 * Normalize a traveler name to title case for consistent display.
 * "IAN ROGERS" → "Ian Rogers", "ian christian rogers" → "Ian Christian Rogers"
 */
function titleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Check if two names refer to the same person.
 * Handles case differences and subset names (e.g., "Ian Rogers" matches "Ian Christian Rogers").
 */
function isSamePerson(a: string, b: string): boolean {
  const partsA = a.toLowerCase().split(/\s+/).filter(Boolean)
  const partsB = b.toLowerCase().split(/\s+/).filter(Boolean)
  // Exact match (case-insensitive)
  if (partsA.join(' ') === partsB.join(' ')) return true
  // Check if one name's parts are a subset of the other's (handles middle names)
  const setA = new Set(partsA)
  const setB = new Set(partsB)
  const aSubsetB = partsA.every((p) => setB.has(p))
  const bSubsetA = partsB.every((p) => setA.has(p))
  return aSubsetB || bSubsetA
}

/**
 * Deduplicate and normalize traveler names from trip items.
 * Handles case variants ("IAN ROGERS" vs "Ian Rogers") and name subsets
 * ("Ian Rogers" vs "Ian Christian Rogers" → keeps the longest form).
 */
export function collectTravelerNames(items: ExtractedItem[]): string[] {
  const rawNames: string[] = []

  for (const item of items) {
    for (const name of item.traveler_names || []) {
      if (name.trim()) {
        rawNames.push(name.trim())
      }
    }
  }

  // Deduplicate: group names that refer to the same person, keep the longest variant
  const deduped: string[] = []
  for (const name of rawNames) {
    const existingIndex = deduped.findIndex((existing) => isSamePerson(existing, name))
    if (existingIndex === -1) {
      deduped.push(name)
    } else {
      // Keep the longer name (more complete form)
      if (name.length > deduped[existingIndex].length) {
        deduped[existingIndex] = name
      }
    }
  }

  return deduped.map(titleCase)
}
