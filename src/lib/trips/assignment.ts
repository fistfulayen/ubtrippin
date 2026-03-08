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
  // 1. Prefer hotel locations — where you sleep is where you are
  const hotelLocations: string[] = []
  for (const item of items) {
    if (item.kind === 'hotel') {
      const loc = item.start_location
      if (loc) hotelLocations.push(loc)
    }
  }
  if (hotelLocations.length > 0) {
    const best = mostFrequentCity(hotelLocations)
    if (best) return best
    // Single hotel — normalise to city (strip hotel names)
    return normaliseToCity(hotelLocations[0]) || hotelLocations[0]
  }

  // 2. Non-flight items: activities, restaurants, trains, etc.
  const groundLocations: string[] = []
  for (const item of items) {
    if (item.kind !== 'flight') {
      const loc = item.end_location || item.start_location
      if (loc) groundLocations.push(loc)
    }
  }
  if (groundLocations.length > 0) {
    const best = mostFrequentCity(groundLocations)
    if (best) return best
  }

  // 3. Flight destinations as last resort
  const flightDests: string[] = []
  for (const item of items) {
    if (item.kind === 'flight' && item.end_location) {
      flightDests.push(item.end_location)
    }
  }
  if (flightDests.length > 0) {
    const best = mostFrequentCity(flightDests)
    if (best) return best
  }

  return null
}

/**
 * Normalise a location string to just the city name.
 * "Paris CDG" → "Paris", "The Vendue, Charleston, SC" → "Charleston",
 * "New York JFK" → "New York", "Tokyo, Japan" → "Tokyo"
 */
function normaliseToCity(location: string): string {
  let city = location.trim()

  // Strip known airport codes (3-letter suffix after a space)
  city = city.replace(/\s+[A-Z]{3}$/, '')

  // If it contains a comma, figure out which segment is the city
  if (city.includes(',')) {
    const segments = city.split(',').map(s => s.trim())
    const first = segments[0]
    // If first segment looks like a venue/hotel name (starts with "The", or has 3+ words),
    // the city is likely the second segment
    const looksLikeVenue = /^The\s/i.test(first) || first.split(/\s+/).length >= 3
    if (looksLikeVenue && segments.length >= 2 && segments[1].length > 1) {
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

  // If original is a clean "City, Country" or "City, State" (2 segments, no venue name),
  // prefer it for display. Otherwise use the normalised city.
  const segments = orig.split(',').map((s: string) => s.trim())
  const firstIsCity = segments.length === 2 && !(/^The\s/i.test(segments[0])) && segments[0].split(/\s+/).length <= 2
  if (firstIsCity) {
    return orig
  }
  return normalised
}

export function collectTravelerNames(items: ExtractedItem[]): string[] {
  const names = new Set<string>()

  for (const item of items) {
    for (const name of item.traveler_names || []) {
      if (name.trim()) {
        names.add(name.trim())
      }
    }
  }

  return Array.from(names)
}
