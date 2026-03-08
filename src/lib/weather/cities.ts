import type { WeatherTripItem, ResolvedCity } from './types'

const SIX_HOURS_MS = 6 * 60 * 60 * 1000

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseDate(date: string | null | undefined, fallback = '00:00'): Date | null {
  if (!date) return null
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T${fallback}:00Z` : date
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function stripAirportFragments(value: string) {
  return value
    .replace(/\b[A-Z]{3}\b Airport\b/gi, '')
    .replace(/\bAirport\b/gi, '')
    .replace(/\bInternational\b/gi, '')
    .replace(/\bTerminal \d+\b/gi, '')
}

function cleanCityPart(value: string) {
  return normalizeWhitespace(
    stripAirportFragments(value)
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[-/]/g, ',')
      .replace(/\s+,/g, ',')
      .replace(/\b\d{5}(-\d{4})?\b/g, '')  // strip US zip codes
  )
}

/**
 * Detect venue/hotel names that aren't city names.
 * "The Vendue" → true, "Grand Beach Hotel Surfside" → true, "Park Hyatt Tokyo" → true
 * "Salt Lake City" → false, "New York" → false
 */
function looksLikeVenueName(name: string): boolean {
  return (
    /^(The|A|An)\s/i.test(name) ||
    /\b(Hotel|Inn|Hostel|Resort|Suites?|Lodge|Motel|Apartments?|Villas?|Palace|House|Gardens?|Manor|Hall|Centre|Center|Venue|Club|Hyatt|Marriott|Hilton|Sheraton|Westin|Radisson|Novotel|Ibis|Sofitel|Intercontinental|Holiday Inn|Best Western|Hampton|Courtyard)\b/i.test(name) ||
    /\d{3,}/.test(name) // street addresses contain 3+ digit numbers
  )
}

export function toCityQuery(location: string | null | undefined): string | null {
  if (!location) return null
  const cleaned = cleanCityPart(location)
  if (!cleaned) return null

  const segments = cleaned
    .split(',')
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean)

  if (segments.length === 0) return null

  // Strip leading airport codes (e.g. "CDG, Paris" → start from "Paris")
  const usableSegments =
    segments[0] && /^[A-Z]{3,4}$/.test(segments[0]) && segments.length > 1
      ? segments.slice(1)
      : segments

  // If the first segment looks like a venue/hotel name, skip to the next segment
  // "Grand Beach Hotel Surfside, 9449 Collins Avenue, Surfside, Florida" → skip to find "Surfside"
  let cityIndex = 0
  while (cityIndex < usableSegments.length && looksLikeVenueName(usableSegments[cityIndex])) {
    cityIndex++
  }
  // If we skipped everything (single venue name with no commas), try to extract a city
  // from the venue name itself by stripping known hotel keywords
  if (cityIndex >= usableSegments.length) {
    const stripped = usableSegments[0]
      .replace(/\b(The|A|An|Hotel|Inn|Hostel|Resort|Suites?|Lodge|Motel|Grand|Royal|Palace|House|Manor|Hall|Park|Hyatt|Marriott|Hilton|Sheraton|Westin|Radisson|Novotel|Ibis|Sofitel|Sonesta|Intercontinental|Hampton|Courtyard|Best|Western)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (stripped && stripped.length > 2) {
      return stripped
    }
    cityIndex = 0
  }

  const city = usableSegments[cityIndex]
  // Look for a region/country after the city
  const regionIndex = cityIndex + 1
  const region = regionIndex < usableSegments.length ? usableSegments[regionIndex] : null
  const parts = [city]
  if (region && !/^\d/.test(region)) parts.push(region)
  return parts.join(', ')
}

function getItemWindow(item: WeatherTripItem) {
  const start = parseDate(item.start_ts ?? item.start_date, '00:00')
  const end = parseDate(item.end_ts ?? item.end_date ?? item.start_date, '23:59')
  if (!start || !end) return null
  return { start, end: end >= start ? end : start }
}

function buildCandidate(item: WeatherTripItem, kindPriority: number, location: string | null): ResolvedCity | null {
  const query = toCityQuery(location)
  const window = getItemWindow(item)
  if (!query || !window) return null

  return {
    city: query,
    query,
    dateStart: isoDate(window.start),
    dateEnd: isoDate(window.end),
    priority: kindPriority,
    sourceKinds: [item.kind],
  }
}

function hotelCandidate(item: WeatherTripItem): ResolvedCity | null {
  return buildCandidate(item, 2, item.start_location ?? item.end_location)
}

function originCandidate(item: WeatherTripItem): ResolvedCity | null {
  return buildCandidate(item, 0, item.start_location)
}

function destinationCandidate(item: WeatherTripItem): ResolvedCity | null {
  return buildCandidate(item, 1, item.end_location ?? item.start_location)
}

export function extractTripCities(items: WeatherTripItem[]): ResolvedCity[] {
  const ordered = [...items].sort((a, b) => {
    const left = parseDate(a.start_ts ?? a.start_date)?.getTime() ?? 0
    const right = parseDate(b.start_ts ?? b.start_date)?.getTime() ?? 0
    return left - right
  })

  const shortLayoverCities = new Set<string>()
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const current = ordered[index]
    const next = ordered[index + 1]
    const currentWindow = getItemWindow(current)
    const nextWindow = getItemWindow(next)
    const arrivalCity = toCityQuery(current.end_location)
    const nextCity = toCityQuery(next.start_location)

    if (!currentWindow || !nextWindow || !arrivalCity || arrivalCity !== nextCity) continue

    const gapMs = nextWindow.start.getTime() - currentWindow.end.getTime()
    if (gapMs >= 0 && gapMs < SIX_HOURS_MS) {
      shortLayoverCities.add(arrivalCity)
    }
  }

  const byCity = new Map<string, ResolvedCity>()

  for (const item of ordered) {
    const candidates =
      item.kind === 'hotel'
        ? [hotelCandidate(item)]
        : [originCandidate(item), destinationCandidate(item)]

    for (const candidate of candidates) {
      if (!candidate) continue
      const existing = byCity.get(candidate.city)
      if (!existing) {
        byCity.set(candidate.city, candidate)
        continue
      }

      const higherPriority = candidate.priority > existing.priority
      const earlierStart = candidate.dateStart < existing.dateStart
      const nextStart = earlierStart ? candidate.dateStart : existing.dateStart
      const nextEnd = candidate.dateEnd > existing.dateEnd ? candidate.dateEnd : existing.dateEnd

      byCity.set(candidate.city, {
        city: higherPriority ? candidate.city : existing.city,
        query: higherPriority ? candidate.query : existing.query,
        dateStart: nextStart,
        dateEnd: nextEnd,
        priority: Math.max(existing.priority, candidate.priority),
        sourceKinds: [...new Set([...existing.sourceKinds, ...candidate.sourceKinds])],
      })
    }
  }

  return [...byCity.values()]
    .filter((city) => !(shortLayoverCities.has(city.city) && city.priority < 2))
    .sort((a, b) => a.dateStart.localeCompare(b.dateStart))
}
