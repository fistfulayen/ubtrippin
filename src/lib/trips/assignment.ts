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

export function getPrimaryLocation(items: ExtractedItem[]): string | null {
  // Find the most common destination location
  const locations: Record<string, number> = {}

  for (const item of items) {
    const loc = item.end_location || item.start_location
    if (loc) {
      locations[loc] = (locations[loc] || 0) + 1
    }
  }

  if (Object.keys(locations).length === 0) return null

  // Return the most frequent location
  const sorted = Object.entries(locations).sort((a, b) => b[1] - a[1])
  return sorted[0][0]
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
