import type { TripItem, Json } from '@/types/database'
import type { WeatherDestination } from '@/lib/weather/types'
import { getWeatherForDate, weatherCodeToEmoji, type TimelineWeatherDay } from '@/lib/weather/item-weather'
import { looksLikeVenueName, normaliseToCity } from './assignment'
import { isSameMetroArea, resolveAirportCity } from './airport-cities'

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

interface AirportPoint {
  code: string
  city: string
  time: string
}

export interface FlightJourney {
  type: 'flight-journey'
  departure: AirportPoint
  arrival: AirportPoint
  stops: number
  stopCodes: string[]
  legs: TripItem[]
  date: string
  duration?: string
}

export interface CitySegment {
  city: string
  countryCode?: string
  startDate: string
  endDate: string
  durationNights: number
  anchorType: 'hotel' | 'airport' | 'activity'
  items: TripItem[]
  weather?: {
    daily: TimelineWeatherDay[]
  }
}

export interface TimelineEntry {
  type: 'transition' | 'segment'
  transition?: FlightJourney
  segment?: CitySegment
  nextSegmentCity?: string
}

interface RawSegment {
  incoming: FlightJourney | null
  outgoing: FlightJourney | null
  items: TripItem[]
}

function isFlightJourney(entry: TripItem | FlightJourney): entry is FlightJourney {
  return 'type' in entry && entry.type === 'flight-journey'
}

function readString(details: Json, key: string): string | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null
  const value = (details as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function extractAirportCode(value: string | null | undefined): string | null {
  if (!value) return null
  const match = value.trim().toUpperCase().match(/\b([A-Z]{3})\b/)
  return match?.[1] ?? null
}

function resolveAirportPoint(item: TripItem, edge: 'departure' | 'arrival'): AirportPoint {
  const code =
    extractAirportCode(readString(item.details_json, edge === 'departure' ? 'departure_airport' : 'arrival_airport')) ??
    extractAirportCode(edge === 'departure' ? item.start_location : item.end_location) ??
    'UNK'
  const airport = resolveAirportCity(code)
  return {
    code,
    city: airport?.city ?? (edge === 'departure' ? item.start_location : item.end_location) ?? code,
    time: readString(item.details_json, edge === 'departure' ? 'departure_local_time' : 'arrival_local_time') ?? '',
  }
}

function parseItemDateTime(item: TripItem, edge: 'start' | 'end'): Date | null {
  const timestamp = edge === 'start' ? item.start_ts : item.end_ts
  if (timestamp) {
    const parsed = new Date(timestamp)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  const date = edge === 'start' ? item.start_date : item.end_date ?? item.start_date
  if (!date) return null
  const time =
    readString(item.details_json, edge === 'start' ? 'departure_local_time' : 'arrival_local_time') ??
    (edge === 'start' ? '00:00' : '23:59')
  const normalizedTime = /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, '0') : edge === 'start' ? '00:00' : '23:59'
  const parsed = new Date(`${date}T${normalizedTime}:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDuration(ms: number): string | undefined {
  if (!Number.isFinite(ms) || ms <= 0) return undefined
  const totalMinutes = Math.round(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}

function buildStopCodes(legs: TripItem[]): string[] {
  const stops: string[] = []
  for (let index = 0; index < legs.length - 1; index += 1) {
    const arrivalCode = resolveAirportPoint(legs[index], 'arrival').code
    const nextDepartureCode = resolveAirportPoint(legs[index + 1], 'departure').code
    if (!stops.includes(arrivalCode)) stops.push(arrivalCode)
    if (nextDepartureCode !== arrivalCode && !stops.includes(nextDepartureCode)) {
      stops.push(nextDepartureCode)
    }
  }
  return stops
}

function isConnection(current: TripItem, next: TripItem): boolean {
  if (current.kind !== 'flight' || next.kind !== 'flight') return false
  const currentArrival = resolveAirportPoint(current, 'arrival').code
  const nextDeparture = resolveAirportPoint(next, 'departure').code
  if (currentArrival !== nextDeparture && !isSameMetroArea(currentArrival, nextDeparture)) return false

  const currentArrivalTime = parseItemDateTime(current, 'end')
  const nextDepartureTime = parseItemDateTime(next, 'start')
  if (!currentArrivalTime || !nextDepartureTime) return false

  const layoverMs = nextDepartureTime.getTime() - currentArrivalTime.getTime()
  return layoverMs >= 0 && layoverMs < FOUR_HOURS_MS
}

function sortItems(items: TripItem[]): TripItem[] {
  return [...items].sort((left, right) => {
    if (left.start_date !== right.start_date) {
      return left.start_date.localeCompare(right.start_date)
    }
    if (left.start_ts && right.start_ts) {
      return (parseItemDateTime(left, 'start')?.getTime() ?? 0) - (parseItemDateTime(right, 'start')?.getTime() ?? 0)
    }
    if (left.start_ts) return -1
    if (right.start_ts) return 1
    const leftTime = parseItemDateTime(left, 'start')?.getTime() ?? 0
    const rightTime = parseItemDateTime(right, 'start')?.getTime() ?? 0
    return leftTime - rightTime
  })
}

function firstPass(items: TripItem[]): Array<TripItem | FlightJourney> {
  const ordered = sortItems(items)
  const processed: Array<TripItem | FlightJourney> = []

  for (let index = 0; index < ordered.length; index += 1) {
    const item = ordered[index]
    if (item.kind !== 'flight') {
      processed.push(item)
      continue
    }

    const legs = [item]
    while (index + 1 < ordered.length && ordered[index + 1].kind === 'flight' && isConnection(legs[legs.length - 1], ordered[index + 1])) {
      legs.push(ordered[index + 1])
      index += 1
    }

    const departure = resolveAirportPoint(legs[0], 'departure')
    const arrival = resolveAirportPoint(legs[legs.length - 1], 'arrival')
    const startTime = parseItemDateTime(legs[0], 'start')?.getTime() ?? 0
    const endTime = parseItemDateTime(legs[legs.length - 1], 'end')?.getTime() ?? startTime
    const stopCodes = buildStopCodes(legs)

    processed.push({
      type: 'flight-journey',
      departure,
      arrival,
      stops: stopCodes.length,
      stopCodes,
      legs,
      date: legs[0].start_date,
      duration: formatDuration(endTime - startTime),
    })
  }

  return processed
}

function looksLikeStreetAddress(value: string): boolean {
  return /^\d+\s/.test(value) || /\b(avenue|street|road|drive|blvd|lane|way)\b/i.test(value)
}

function cleanLocationPart(value: string): string {
  return value.replace(/\b\d{5}(?:-\d{4})?\b/g, '').replace(/\s+/g, ' ').trim()
}

function deriveDisplayLocation(location: string): string | null {
  const parts = location
    .split(',')
    .map((part) => cleanLocationPart(part))
    .filter(Boolean)
  if (parts.length === 0) return null

  let index = 0
  while (index < parts.length && (looksLikeVenueName(parts[index]) || looksLikeStreetAddress(parts[index]))) {
    index += 1
  }
  if (index >= parts.length) return null

  const city = normaliseToCity(parts[index])
  const region = parts[index + 1]
  return region && region.length <= 24 ? `${city}, ${region}` : city
}

function deriveSegmentIdentity(raw: RawSegment): Pick<CitySegment, 'city' | 'countryCode' | 'anchorType'> {
  const hotel = raw.items.find((item) => item.kind === 'hotel')
  if (hotel) {
    const hotelLocation = hotel.start_location ?? hotel.end_location
    const label = hotelLocation ? deriveDisplayLocation(hotelLocation) : null
    if (label && !looksLikeVenueName(label)) {
      return { city: label, countryCode: undefined, anchorType: 'hotel' }
    }
  }

  const activity = raw.items.find((item) => item.kind !== 'hotel')
  if (activity) {
    const activityLocation = activity.end_location ?? activity.start_location
    const label = activityLocation ? deriveDisplayLocation(activityLocation) : null
    if (label) return { city: label, countryCode: undefined, anchorType: 'activity' }
  }

  const airport = raw.incoming ? resolveAirportCity(raw.incoming.arrival.code) : null
  if (airport) {
    return { city: airport.city, countryCode: airport.countryCode, anchorType: 'airport' }
  }

  const fallback = hotel?.start_location ?? activity?.end_location ?? activity?.start_location ?? 'Unknown'
  return {
    city: normaliseToCity(fallback),
    countryCode: undefined,
    anchorType: hotel ? 'hotel' : 'activity',
  }
}

function nightsBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const diff = Math.round((end.getTime() - start.getTime()) / DAY_MS)
  return Math.max(0, diff)
}

function buildSegment(raw: RawSegment): CitySegment {
  const startDate =
    raw.items[0]?.start_date ??
    raw.incoming?.legs[raw.incoming.legs.length - 1]?.end_date ??
    raw.incoming?.date ??
    raw.outgoing?.date ??
    ''
  const endDate =
    raw.outgoing?.date ??
    raw.items[raw.items.length - 1]?.end_date ??
    raw.items[raw.items.length - 1]?.start_date ??
    raw.incoming?.legs[raw.incoming.legs.length - 1]?.end_date ??
    startDate
  const identity = deriveSegmentIdentity(raw)

  return {
    city: identity.city,
    countryCode: identity.countryCode,
    startDate,
    endDate,
    durationNights: nightsBetween(startDate, endDate),
    anchorType: identity.anchorType,
    items: raw.items,
  }
}

function cityKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function matchesWeatherCity(segmentCity: string, weatherCity: string): boolean {
  const left = cityKey(segmentCity)
  const right = cityKey(weatherCity)
  return left === right || left.startsWith(right) || right.startsWith(left)
}

export function attachWeatherToTimeline(entries: TimelineEntry[], destinations: WeatherDestination[]): TimelineEntry[] {
  return entries.map((entry) => {
    if (entry.type !== 'segment' || !entry.segment) return entry
    const destination = destinations.find((candidate) => matchesWeatherCity(entry.segment!.city, candidate.city))
    if (!destination) return entry

    return {
      ...entry,
      segment: {
        ...entry.segment,
        weather: {
          daily: destination.daily.map((day) => ({
            date: day.date,
            emoji: weatherCodeToEmoji(day.weather_code),
            high: day.temp_high,
            low: day.temp_low,
          })),
        },
      },
    }
  })
}

export function weatherForItem(segment: CitySegment, item: TripItem): TimelineWeatherDay | null {
  return getWeatherForDate(segment.weather?.daily, item.start_date)
}

export function buildTimeline(items: TripItem[]): TimelineEntry[] {
  const processed = firstPass(items)
  const rawSegments: RawSegment[] = []
  const transitions: FlightJourney[] = []
  let incoming: FlightJourney | null = null
  let currentItems: TripItem[] = []

  for (const entry of processed) {
    if (isFlightJourney(entry)) {
      if (incoming || currentItems.length > 0) {
        rawSegments.push({ incoming, outgoing: entry, items: currentItems })
      }
      transitions.push(entry)
      incoming = entry
      currentItems = []
      continue
    }

    currentItems.push(entry)
  }

  if (incoming || currentItems.length > 0) {
    rawSegments.push({ incoming, outgoing: null, items: currentItems })
  }

  const segments = rawSegments.map(buildSegment)
  const timeline: TimelineEntry[] = []
  let segmentIndex = 0

  for (const transition of transitions) {
    const nextSegment =
      segments[segmentIndex] && rawSegments[segmentIndex]?.incoming === transition
        ? segments[segmentIndex]
        : null

    timeline.push({
      type: 'transition',
      transition,
      nextSegmentCity: nextSegment?.city ?? resolveAirportCity(transition.arrival.code)?.city ?? transition.arrival.city,
    })

    if (nextSegment) {
      timeline.push({ type: 'segment', segment: nextSegment })
      segmentIndex += 1
    }
  }

  while (segmentIndex < segments.length) {
    timeline.push({ type: 'segment', segment: segments[segmentIndex] })
    segmentIndex += 1
  }

  return timeline
}
