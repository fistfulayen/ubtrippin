import type { TripItem } from '@/types/database'
import type { ForecastDay } from '@/lib/weather/types'
import { AIRPORT_CITIES, getMetroArea } from './airport-cities'
import { normaliseToCity } from './assignment'

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export interface TripItemWithWeather extends TripItem {
  weather?: { emoji: string; temp: string; condition?: string }
}

export interface CitySegment {
  city: string
  countryCode?: string
  startDate: string
  endDate: string
  durationNights: number
  anchorType: 'hotel' | 'airport'
  items: TripItemWithWeather[]
  transitions: TripItemWithWeather[]
  weatherForecast?: ForecastDay[]
  weatherUnit?: '°F' | '°C'
}

interface ResolvedPlace {
  city: string
  countryCode?: string
  key: string
}

interface PendingArrival extends ResolvedPlace {
  arrivedAt: Date
}

interface InternalSegment extends CitySegment {
  key: string
  startAt: Date
  endAt: Date
}

function parseDateTime(value: string | null | undefined, fallbackTime: string) {
  if (!value) return null
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${fallbackTime}:00` : value
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getItemStart(item: TripItem) {
  return parseDateTime(item.start_ts ?? item.start_date, '00:00') ?? new Date(`${item.start_date}T00:00:00`)
}

function getItemEnd(item: TripItem) {
  return (
    parseDateTime(item.end_ts ?? item.end_date ?? item.start_date, '23:59') ??
    new Date(`${item.end_date ?? item.start_date}T23:59:00`)
  )
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function durationNights(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  const diff = Math.round((end.getTime() - start.getTime()) / ONE_DAY_MS)
  return Math.max(0, diff)
}

function extractAirportCode(location: string | null | undefined, detailsKey: unknown) {
  if (typeof detailsKey === 'string' && AIRPORT_CITIES[detailsKey.trim().toUpperCase()]) {
    return detailsKey.trim().toUpperCase()
  }

  if (!location) return null
  const codeMatch = location.match(/\b([A-Z]{3})\b/)
  if (!codeMatch) return null
  const code = codeMatch[1].toUpperCase()
  return AIRPORT_CITIES[code] ? code : null
}

function airportPlace(code: string | null) {
  if (!code) return null
  const airport = AIRPORT_CITIES[code]
  if (!airport) return null
  const metro = getMetroArea(code)
  const city = metro ?? airport.city
  return {
    city,
    countryCode: airport.countryCode,
    key: `${airport.countryCode}:${city.toLowerCase()}`,
  } satisfies ResolvedPlace
}

function resolveFlightEndpoint(item: TripItem, direction: 'start' | 'end'): ResolvedPlace | null {
  const details =
    item.details_json && typeof item.details_json === 'object' && !Array.isArray(item.details_json)
      ? (item.details_json as Record<string, unknown>)
      : null

  const airportCode = extractAirportCode(
    direction === 'start' ? item.start_location : item.end_location,
    direction === 'start' ? details?.departure_airport : details?.arrival_airport
  )

  return airportPlace(airportCode)
}

function resolveHotelPlace(item: TripItem): ResolvedPlace | null {
  const location = item.start_location ?? item.end_location
  if (!location) return null

  const parts = location.split(',').map((part) => part.trim()).filter(Boolean)
  const city = normaliseToCity(location)
  if (!city) return null

  // Derive country code from known country names, not state abbreviations
  const US_STATES = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'])
  const lastPart = parts[parts.length - 1]?.trim().toUpperCase() ?? ''
  const countryCode =
    lastPart === 'USA' || lastPart === 'US' || lastPart === 'UNITED STATES'
      ? 'US'
      : US_STATES.has(lastPart)
        ? 'US'  // State abbreviation implies US
        : /^[A-Z]{2}$/.test(lastPart) && !US_STATES.has(lastPart)
          ? lastPart  // Actual 2-letter country code (FR, IT, JP, etc.)
          : undefined

  const displayCity =
    parts.length >= 2
      ? `${city}, ${parts[0] === city ? parts[1] : parts[Math.min(parts.length - 1, 2)]}`
      : city

  return {
    city: displayCity,
    countryCode,
    key: `${countryCode ?? 'xx'}:${city.toLowerCase()}`,
  }
}

function resolveGroundPlace(item: TripItem): ResolvedPlace | null {
  const location = item.start_location ?? item.end_location
  if (!location) return null
  const city = normaliseToCity(location)
  if (!city) return null
  return {
    city,
    key: `xx:${city.toLowerCase()}`,
  }
}

function samePlace(left: ResolvedPlace | null, right: ResolvedPlace | null) {
  if (!left || !right) return false
  return left.key === right.key
}

function createSegment(place: ResolvedPlace, anchorType: 'hotel' | 'airport', startAt: Date, endAt: Date): InternalSegment {
  const startDate = isoDate(startAt)
  const endDate = isoDate(endAt)

  return {
    city: place.city,
    countryCode: place.countryCode,
    startDate,
    endDate,
    durationNights: durationNights(startDate, endDate),
    anchorType,
    items: [],
    transitions: [],
    key: place.key,
    startAt,
    endAt,
  }
}

function syncSegmentDates(segment: InternalSegment) {
  segment.startDate = isoDate(segment.startAt)
  segment.endDate = isoDate(segment.endAt)
  segment.durationNights = durationNights(segment.startDate, segment.endDate)
}

function mergeAdjacentSegments(segments: InternalSegment[]) {
  return segments.reduce<InternalSegment[]>((merged, segment) => {
    const previous = merged.at(-1)
    if (!previous || previous.key !== segment.key) {
      merged.push(segment)
      return merged
    }

    previous.startAt = previous.startAt <= segment.startAt ? previous.startAt : segment.startAt
    previous.endAt = previous.endAt >= segment.endAt ? previous.endAt : segment.endAt
    previous.anchorType = previous.anchorType === 'hotel' || segment.anchorType === 'hotel' ? 'hotel' : 'airport'
    previous.city = segment.anchorType === 'hotel' ? segment.city : previous.city
    previous.countryCode = previous.countryCode ?? segment.countryCode
    previous.items = [...previous.items, ...segment.items]
    previous.transitions = [...previous.transitions, ...segment.transitions]
    syncSegmentDates(previous)
    return merged
  }, [])
}

function normalizeTransitionPlacement(segments: InternalSegment[]) {
  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1]
    const current = segments[index]
    if (current.transitions.length === 0) continue
    if (previous.transitions.length > 0) continue

    previous.transitions = [...previous.transitions, ...current.transitions]
    current.transitions = []
  }

  return segments
}

function attachItem(segment: InternalSegment, item: TripItemWithWeather) {
  segment.items.push(item)
  const itemStart = getItemStart(item)
  const itemEnd = getItemEnd(item)
  if (itemStart < segment.startAt) segment.startAt = itemStart
  if (itemEnd > segment.endAt) segment.endAt = itemEnd
  syncSegmentDates(segment)
}

function ensurePendingLayoverSegment(
  pendingArrival: PendingArrival | null,
  nextFlight: TripItem,
  previousSegment: InternalSegment | null,
  segments: InternalSegment[]
) {
  if (!pendingArrival) return null

  const origin = resolveFlightEndpoint(nextFlight, 'start')
  const gapMs = getItemStart(nextFlight).getTime() - pendingArrival.arrivedAt.getTime()

  if (samePlace(pendingArrival, origin) && gapMs >= 0 && gapMs < FOUR_HOURS_MS) {
    return null
  }

  const segment = createSegment(
    pendingArrival,
    'airport',
    pendingArrival.arrivedAt,
    getItemStart(nextFlight)
  )

  if (previousSegment && previousSegment.transitions.length === 0) {
    previousSegment.endAt = pendingArrival.arrivedAt
    syncSegmentDates(previousSegment)
  }

  segments.push(segment)
  return segment
}

export function buildCitySegments(items: TripItem[]): CitySegment[] {
  if (items.length === 0) return []

  const ordered = [...items].sort((left, right) => getItemStart(left).getTime() - getItemStart(right).getTime())
  const segments: InternalSegment[] = []
  let currentSegment: InternalSegment | null = null
  let pendingArrival: PendingArrival | null = null
  let activeTransitionFlights: TripItemWithWeather[] = []

  for (const item of ordered) {
    const typedItem = item as TripItemWithWeather

    if (item.kind === 'flight') {
      if (!currentSegment && pendingArrival) {
        currentSegment = ensurePendingLayoverSegment(
          pendingArrival,
          item,
          segments.at(-1) ?? null,
          segments
        )
        pendingArrival = null
      }

      if (!currentSegment && segments.length === 0) {
        const origin = resolveFlightEndpoint(item, 'start')
        if (origin) {
          currentSegment = createSegment(origin, 'airport', getItemStart(item), getItemStart(item))
          segments.push(currentSegment)
        }
      }

      activeTransitionFlights.push(typedItem)
      currentSegment = null

      const destination = resolveFlightEndpoint(item, 'end')
      if (destination) {
        pendingArrival = {
          ...destination,
          arrivedAt: getItemEnd(item),
        }
      }

      continue
    }

    const hotelPlace = item.kind === 'hotel' ? resolveHotelPlace(item) : null
    const groundPlace = hotelPlace ?? resolveGroundPlace(item) ?? pendingArrival
    const previousSegment = segments.at(-1) ?? null

    if (groundPlace && (!currentSegment || !samePlace(currentSegment, groundPlace))) {
      currentSegment = createSegment(
        groundPlace,
        hotelPlace ? 'hotel' : pendingArrival ? 'airport' : 'hotel',
        pendingArrival?.arrivedAt ?? getItemStart(item),
        getItemEnd(item)
      )

      if (previousSegment && activeTransitionFlights.length > 0) {
        previousSegment.transitions = [...previousSegment.transitions, ...activeTransitionFlights]
      }

      activeTransitionFlights = []
      pendingArrival = null
      segments.push(currentSegment)
    }

    if (!currentSegment) {
      const fallbackPlace = groundPlace ?? resolveGroundPlace(item)
      if (!fallbackPlace) continue
      currentSegment = createSegment(fallbackPlace, hotelPlace ? 'hotel' : 'airport', getItemStart(item), getItemEnd(item))
      segments.push(currentSegment)
    }

    if (hotelPlace && samePlace(currentSegment, hotelPlace)) {
      currentSegment.anchorType = 'hotel'
      currentSegment.city = hotelPlace.city
      currentSegment.countryCode = hotelPlace.countryCode ?? currentSegment.countryCode
      currentSegment.key = hotelPlace.key
    }

    attachItem(currentSegment, typedItem)
  }

  if (pendingArrival) {
    const previousSegment = segments.at(-1) ?? null
    const finalSegment = createSegment(pendingArrival, 'airport', pendingArrival.arrivedAt, pendingArrival.arrivedAt)
    if (previousSegment && activeTransitionFlights.length > 0) {
      previousSegment.transitions = [...previousSegment.transitions, ...activeTransitionFlights]
    }
    segments.push(finalSegment)
  } else if (segments.length > 0 && activeTransitionFlights.length > 0) {
    segments[segments.length - 1].transitions = [
      ...segments[segments.length - 1].transitions,
      ...activeTransitionFlights,
    ]
  }

  return normalizeTransitionPlacement(mergeAdjacentSegments(segments)).map((segment) => ({
    city: segment.city,
    countryCode: segment.countryCode,
    startDate: segment.startDate,
    endDate: segment.endDate,
    durationNights: segment.durationNights,
    anchorType: segment.anchorType,
    items: segment.items,
    transitions: segment.transitions,
    weatherForecast: segment.weatherForecast,
    weatherUnit: segment.weatherUnit,
  }))
}
