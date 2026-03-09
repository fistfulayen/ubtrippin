import type { Trip } from '@/types/database'
import type { ExtractedItem } from '@/lib/ai/extract-travel-data'

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
  const location = item.end_location || item.start_location

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
 * Derive the primary location for a trip from its items.
 *
 * Priority:
 * 1. Hotel/accommodation start_location (where you sleep = where you are)
 * 2. Most-repeated city across all non-flight items (activities, restaurants, trains)
 * 3. Most-repeated flight destination as fallback
 *
 * Normalises city names so "Paris CDG", "Paris, France", and "Paris" all count as "Paris".
 */
export function getPrimaryLocation(items: ExtractedItem[]): string | null {
  // Single pass to categorise locations
  const hotelLocations: string[] = []
  const groundLocations: string[] = []
  const flightDests: string[] = []

  for (const item of items) {
    if (item.kind === 'hotel') {
      if (item.start_location) hotelLocations.push(item.start_location)
    } else if (item.kind !== 'flight') {
      const loc = item.end_location || item.start_location
      if (loc) groundLocations.push(loc)
    } else {
      if (item.end_location) flightDests.push(item.end_location)
    }
  }

  // 1. Prefer hotel locations — where you sleep is where you are
  if (hotelLocations.length > 0) {
    const best = mostFrequentCity(hotelLocations)
    if (best) return best
  }

  // 2. Non-flight items: activities, restaurants, trains, etc.
  if (groundLocations.length > 0) {
    const best = mostFrequentCity(groundLocations)
    if (best) return best
  }

  // 3. Flight destinations as last resort
  if (flightDests.length > 0) {
    const best = mostFrequentCity(flightDests)
    if (best) return best
  }

  return null
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
    /\b(Hotel|Inn|Hostel|Resort|Suites?|Lodge|Motel|Apartments?|Villas?|Palace|House|Gardens|Manor|Hall|Centre|Center|Venue|Club)\b/i.test(name)
  )
}

/**
 * Normalise a location string to just the city name.
 * "Paris CDG" → "Paris", "The Vendue, Charleston, SC" → "Charleston",
 * "New York JFK" → "New York", "New York (JFK)" → "New York",
 * "New York City, NY" → "New York City", "Tokyo, Japan" → "Tokyo"
 */
export function normaliseToCity(location: string): string {
  let city = location.trim()

  // Strip airport codes: parenthesized "(JFK)" style and trailing " JFK" style
  city = city.replace(/\s*\([A-Z]{3}\)/g, '') // Remove (JFK) style
  city = city.replace(/\s+[A-Z]{3}$/, '')     // Remove trailing " JFK" style

  // If it contains a comma, figure out which segment is the city
  if (city.includes(',')) {
    const segments = city.split(',').map(s => s.trim())
    const first = segments[0]
    // Venue detection uses article/keyword signals — not word count, which would
    // incorrectly mangle multi-word cities like "New York City" or "Salt Lake City"
    if (looksLikeVenueName(first) && segments.length >= 2 && segments[1].length > 1) {
      city = segments[1]
    } else {
      city = first
    }
  }

  return city
}

/** Return the most frequent city from a list of location strings. */
function mostFrequentCity(locations: string[]): string | null {
  const counts: Record<string, { count: number; original: string }> = {}

  for (const loc of locations) {
    const city = normaliseToCity(loc)
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
  const normalised = normaliseToCity(orig)

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
