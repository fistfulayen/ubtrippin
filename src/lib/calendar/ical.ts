import type { Trip, TripItem, Json, FlightDetails, HotelDetails, TrainDetails } from '@/types/database'
import { getAirportTimezone, getVTimezoneBlock } from './airport-timezones'

const PROD_ID = '-//UB Trippin//Travel Calendar//EN'
const CALENDAR_NAME = 'UB Trippin Trips'

type ItemWithTrip = TripItem & { trip?: Trip | null }

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function foldLine(line: string): string {
  if (line.length <= 75) return line

  const chunks: string[] = []
  let cursor = 0
  while (cursor < line.length) {
    const chunk = line.slice(cursor, cursor + 75)
    chunks.push(cursor === 0 ? chunk : ` ${chunk}`)
    cursor += 75
  }
  return chunks.join('\r\n')
}

function toUtcDateTime(value: Date): string {
  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  const day = String(value.getUTCDate()).padStart(2, '0')
  const hours = String(value.getUTCHours()).padStart(2, '0')
  const minutes = String(value.getUTCMinutes()).padStart(2, '0')
  const seconds = String(value.getUTCSeconds()).padStart(2, '0')
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

function toDateValue(value: string): string {
  return value.replace(/-/g, '')
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDetailObject(details: Json): Record<string, unknown> {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {}
  return details as Record<string, unknown>
}

function normalizeTime(value: string | null | undefined): string | null {
  if (!value) return null
  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  const hours = String(Number(match[1])).padStart(2, '0')
  const minutes = match[2]
  return `${hours}${minutes}00`
}

function isoToFloatingDateTime(value: string | null): string | null {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) return null
  return `${match[1]}${match[2]}${match[3]}T${match[4]}${match[5]}00`
}

function localDateTime(
  date: string | null,
  localTime: string | null,
  fallbackIso: string | null
): string | null {
  const normalized = normalizeTime(localTime)
  if (date && normalized) {
    return `${date.replace(/-/g, '')}T${normalized}`
  }
  return isoToFloatingDateTime(fallbackIso)
}

/** Build a DTSTART or DTEND property line, using TZID when we know the airport timezone. */
function buildDateTimeProp(
  propName: 'DTSTART' | 'DTEND',
  dateStr: string | null,
  localTime: string | null,
  fallbackIso: string | null,
  airportCode: string | null | undefined,
  collectedTzids: Set<string>
): string | null {
  const datetime = localDateTime(dateStr, localTime, fallbackIso)
  if (!datetime) return null

  const tzid = airportCode ? getAirportTimezone(airportCode) : null
  if (tzid) {
    collectedTzids.add(tzid)
    return `${propName};TZID=${tzid}:${datetime}`
  }
  return `${propName}:${datetime}`
}

// ─── DESCRIPTION builders ────────────────────────────────────────────────────

function buildFlightDescription(item: TripItem, details: FlightDetails): string {
  const lines: string[] = []

  const airline = (details.airline ?? item.provider ?? '').trim()
  const flightNumber = (details.flight_number ?? '').trim()
  if (airline || flightNumber) {
    lines.push([airline, flightNumber].filter(Boolean).join(' '))
  }

  lines.push('')

  // Departure block
  const depParts: string[] = []
  if (details.departure_airport) depParts.push(details.departure_airport)
  if (details.departure_terminal) depParts.push(`Terminal ${details.departure_terminal}`)
  if (details.departure_gate) depParts.push(`Gate ${details.departure_gate}`)
  const depTime = (details as Record<string, unknown>).departure_local_time as string | undefined
  if (depTime) depParts.push(depTime)
  if (depParts.length) lines.push(`Departs: ${depParts.join(' · ')}`)

  // Arrival block
  const arrParts: string[] = []
  if (details.arrival_airport) arrParts.push(details.arrival_airport)
  if (details.arrival_terminal) arrParts.push(`Terminal ${details.arrival_terminal}`)
  if (details.arrival_gate) arrParts.push(`Gate ${details.arrival_gate}`)
  const arrTime = (details as Record<string, unknown>).arrival_local_time as string | undefined
  if (arrTime) arrParts.push(arrTime)
  if (arrParts.length) lines.push(`Arrives: ${arrParts.join(' · ')}`)

  lines.push('')

  // Cabin / seat
  const cabinParts: string[] = []
  if (details.cabin_class) cabinParts.push(details.cabin_class)
  if (details.seat) cabinParts.push(`Seat ${details.seat}`)
  if (cabinParts.length) lines.push(cabinParts.join(' · '))

  // Confirmation
  const conf = item.confirmation_code ?? details.booking_reference ?? ''
  if (conf) lines.push(`Confirmation: ${conf}`)

  // Travelers
  if (item.traveler_names?.length) {
    lines.push(`Travelers: ${item.traveler_names.join(', ')}`)
  }

  return lines.join('\n').trim()
}

function buildHotelDescription(item: TripItem, details: HotelDetails): string {
  const lines: string[] = []

  const name = (details.hotel_name ?? item.provider ?? '').trim()
  if (name) lines.push(name)

  const address = (details.address ?? item.start_location ?? '').trim()
  if (address) lines.push(address)

  lines.push('')

  if (details.check_in_time) lines.push(`Check-in: ${details.check_in_time}`)
  if (details.check_out_time) lines.push(`Check-out: ${details.check_out_time}`)
  if (details.room_type) lines.push(`Room: ${details.room_type}`)

  const conf = item.confirmation_code ?? details.booking_reference ?? ''
  if (conf) lines.push(`Confirmation: ${conf}`)

  if (details.contact_phone) lines.push(`Phone: ${details.contact_phone}`)

  if (item.traveler_names?.length) {
    lines.push(`Guests: ${item.traveler_names.join(', ')}`)
  }

  return lines.join('\n').trim()
}

function buildTrainDescription(item: TripItem, details: TrainDetails): string {
  const lines: string[] = []

  const operator = (details.operator ?? item.provider ?? '').trim()
  const trainNumber = (details.train_number ?? '').trim()
  if (operator || trainNumber) {
    lines.push([operator, trainNumber].filter(Boolean).join(' '))
  }

  lines.push('')

  if (details.departure_station) lines.push(`From: ${details.departure_station}`)
  if (details.arrival_station) lines.push(`To: ${details.arrival_station}`)

  const seatParts: string[] = []
  if (details.carriage) seatParts.push(`Car ${details.carriage}`)
  if (details.seat) seatParts.push(`Seat ${details.seat}`)
  if (seatParts.length) lines.push(seatParts.join(' · '))

  const conf = item.confirmation_code ?? details.booking_reference ?? ''
  if (conf) lines.push(`Confirmation: ${conf}`)

  if (item.traveler_names?.length) {
    lines.push(`Travelers: ${item.traveler_names.join(', ')}`)
  }

  return lines.join('\n').trim()
}

/** Standard 30-minute before alarm block. */
function buildValarm(): string[] {
  return [
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'END:VALARM',
  ]
}

// ─── Event builder ───────────────────────────────────────────────────────────

function buildFlightSummary(item: TripItem, details: Record<string, unknown>): string {
  const airline = (details.airline as string | undefined)?.trim() || item.provider?.trim() || 'Flight'
  const flightNumber = (details.flight_number as string | undefined)?.trim()
  return flightNumber ? `${airline} ${flightNumber}` : airline
}

function buildFlightLocation(item: TripItem, details: Record<string, unknown>): string | null {
  const departure = ((details.departure_airport as string | undefined) || item.start_location || '').trim()
  const arrival = ((details.arrival_airport as string | undefined) || item.end_location || '').trim()
  if (departure && arrival) return `${departure} -> ${arrival}`
  return departure || arrival || null
}

function buildEventLines(
  item: TripItem,
  collectedTzids: Set<string>,
  trip?: Trip | null
): string[] {
  const details = parseDetailObject(item.details_json)
  const now = toUtcDateTime(new Date())
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${item.id}@ubtrippin.xyz`,
    `DTSTAMP:${now}`,
  ]

  if (item.kind === 'hotel') {
    const checkIn = item.start_date
    const checkOut = item.end_date || addDays(item.start_date, 1)
    const summary = (details.hotel_name as string | undefined)?.trim()
      || item.summary?.trim()
      || item.provider?.trim()
      || 'Hotel stay'

    lines.push(`SUMMARY:${escapeIcsText(summary)}`)
    lines.push(`DTSTART;VALUE=DATE:${toDateValue(checkIn)}`)
    lines.push(`DTEND;VALUE=DATE:${toDateValue(checkOut)}`)

    const location = (details.address as string | undefined)?.trim()
      || item.start_location?.trim()
      || null
    if (location) lines.push(`LOCATION:${escapeIcsText(location)}`)

    // Rich description
    const hotelDetails = details as unknown as HotelDetails
    const desc = buildHotelDescription(item, hotelDetails)
    if (desc) lines.push(`DESCRIPTION:${escapeIcsText(desc)}`)

    // Alarm
    lines.push(...buildValarm())
  } else if (item.kind === 'flight') {
    const flightDetails = details as unknown as FlightDetails
    const depAirport = (flightDetails.departure_airport ?? item.start_location ?? '').trim() || null
    const arrAirport = (flightDetails.arrival_airport ?? item.end_location ?? '').trim() || null

    const depLocalTime = (details.departure_local_time as string | undefined) ?? null
    const arrLocalTime = (details.arrival_local_time as string | undefined) ?? null

    const endDate = item.end_date || item.start_date

    const dtstart = buildDateTimeProp(
      'DTSTART',
      item.start_date,
      depLocalTime,
      item.start_ts,
      depAirport,
      collectedTzids
    )
    const dtend = buildDateTimeProp(
      'DTEND',
      endDate,
      arrLocalTime,
      item.end_ts,
      arrAirport,
      collectedTzids
    )

    lines.push(`SUMMARY:${escapeIcsText(buildFlightSummary(item, details))}`)

    if (dtstart) lines.push(dtstart)
    else lines.push(`DTSTART;VALUE=DATE:${toDateValue(item.start_date)}`)

    if (dtend) lines.push(dtend)
    else if (item.end_date) lines.push(`DTEND;VALUE=DATE:${toDateValue(addDays(item.end_date, 1))}`)
    else lines.push(`DTEND;VALUE=DATE:${toDateValue(addDays(item.start_date, 1))}`)

    const location = buildFlightLocation(item, details)
    if (location) lines.push(`LOCATION:${escapeIcsText(location)}`)

    // Rich description (pass extra local time fields through the record)
    const desc = buildFlightDescription(item, {
      ...flightDetails,
      departure_local_time: depLocalTime ?? undefined,
      arrival_local_time: arrLocalTime ?? undefined,
    } as FlightDetails)
    if (desc) lines.push(`DESCRIPTION:${escapeIcsText(desc)}`)

    // Alarm
    lines.push(...buildValarm())
  } else if (item.kind === 'train') {
    const trainDetails = details as unknown as TrainDetails

    const preferredStartTime = (details.departure_local_time as string | undefined) ?? null
    const preferredEndTime = (details.arrival_local_time as string | undefined) ?? null

    const startLocal = localDateTime(item.start_date, preferredStartTime, item.start_ts)
    const endDate = item.end_date || item.start_date
    const endLocal = localDateTime(endDate, preferredEndTime, item.end_ts)

    const summary = item.summary?.trim()
      || item.provider?.trim()
      || 'Train'

    lines.push(`SUMMARY:${escapeIcsText(summary)}`)

    if (startLocal) lines.push(`DTSTART:${startLocal}`)
    else lines.push(`DTSTART;VALUE=DATE:${toDateValue(item.start_date)}`)

    if (endLocal) lines.push(`DTEND:${endLocal}`)
    else if (item.end_date) lines.push(`DTEND;VALUE=DATE:${toDateValue(addDays(item.end_date, 1))}`)
    else lines.push(`DTEND;VALUE=DATE:${toDateValue(addDays(item.start_date, 1))}`)

    const location = (trainDetails.departure_station ?? item.start_location ?? '').trim() || null
    if (location) lines.push(`LOCATION:${escapeIcsText(location)}`)

    const desc = buildTrainDescription(item, trainDetails)
    if (desc) lines.push(`DESCRIPTION:${escapeIcsText(desc)}`)

    lines.push(...buildValarm())
  } else {
    const summary = item.summary?.trim()
      || item.provider?.trim()
      || `${item.kind[0].toUpperCase()}${item.kind.slice(1)}`

    const preferredStartTime =
      (details.departure_local_time as string | undefined)
      || (details.check_in_time as string | undefined)
      || null
    const preferredEndTime =
      (details.arrival_local_time as string | undefined)
      || (details.check_out_time as string | undefined)
      || null

    const startLocal = localDateTime(item.start_date, preferredStartTime, item.start_ts)
    const endDate = item.end_date || item.start_date
    const endLocal = localDateTime(endDate, preferredEndTime, item.end_ts)

    lines.push(`SUMMARY:${escapeIcsText(summary)}`)
    if (startLocal) lines.push(`DTSTART:${startLocal}`)
    else lines.push(`DTSTART;VALUE=DATE:${toDateValue(item.start_date)}`)

    if (endLocal) lines.push(`DTEND:${endLocal}`)
    else if (item.end_date) lines.push(`DTEND;VALUE=DATE:${toDateValue(addDays(item.end_date, 1))}`)
    else lines.push(`DTEND;VALUE=DATE:${toDateValue(addDays(item.start_date, 1))}`)

    const location = item.start_location?.trim() || item.end_location?.trim() || null
    if (location) lines.push(`LOCATION:${escapeIcsText(location)}`)
  }

  if (trip?.title) {
    lines.push(`CATEGORIES:${escapeIcsText(trip.title)}`)
  }

  lines.push('END:VEVENT')
  return lines
}

function buildTripSpanEvent(trip: Trip): string[] {
  if (!trip.start_date) return []

  const endDateInclusive = trip.end_date || trip.start_date
  const endDateExclusive = addDays(endDateInclusive, 1)
  const now = toUtcDateTime(new Date())

  return [
    'BEGIN:VEVENT',
    `UID:trip-${trip.id}@ubtrippin.xyz`,
    `DTSTAMP:${now}`,
    `SUMMARY:${escapeIcsText(trip.title)}`,
    `DTSTART;VALUE=DATE:${toDateValue(trip.start_date)}`,
    `DTEND;VALUE=DATE:${toDateValue(endDateExclusive)}`,
    trip.primary_location ? `LOCATION:${escapeIcsText(trip.primary_location)}` : '',
    'END:VEVENT',
  ].filter(Boolean) as string[]
}

function buildCalendar(events: string[], tzids: Set<string>): string {
  // Collect VTIMEZONE blocks for all timezone IDs used
  const vtimezoneLines: string[] = []
  for (const tzid of tzids) {
    const block = getVTimezoneBlock(tzid)
    if (block) vtimezoneLines.push(...block)
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PROD_ID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(CALENDAR_NAME)}`,
    ...vtimezoneLines,
    ...events,
    'END:VCALENDAR',
  ]

  return lines.map(foldLine).join('\r\n').concat('\r\n')
}

export function generateTripICal(trip: Trip, items: TripItem[]): string {
  const sorted = [...items].sort((a, b) => {
    const aKey = `${a.start_date} ${a.start_ts ?? ''}`
    const bKey = `${b.start_date} ${b.start_ts ?? ''}`
    return aKey.localeCompare(bKey)
  })

  const collectedTzids = new Set<string>()
  const events: string[] = []
  events.push(...buildTripSpanEvent(trip))
  for (const item of sorted) {
    events.push(...buildEventLines(item, collectedTzids, trip))
  }

  return buildCalendar(events, collectedTzids)
}

export function generateFeedICal(trips: Trip[], items: ItemWithTrip[]): string {
  const tripMap = new Map(trips.map((trip) => [trip.id, trip]))
  const groupedItems = new Map<string, TripItem[]>()

  for (const item of items) {
    if (!item.trip_id) continue
    const bucket = groupedItems.get(item.trip_id) ?? []
    bucket.push(item)
    groupedItems.set(item.trip_id, bucket)
  }

  const collectedTzids = new Set<string>()
  const events: string[] = []

  const sortedTrips = [...trips].sort((a, b) => {
    const aKey = a.start_date ?? ''
    const bKey = b.start_date ?? ''
    return aKey.localeCompare(bKey)
  })

  for (const trip of sortedTrips) {
    events.push(...buildTripSpanEvent(trip))
    const tripItems = groupedItems.get(trip.id) ?? []
    const sortedItems = tripItems.sort((a, b) => {
      const aKey = `${a.start_date} ${a.start_ts ?? ''}`
      const bKey = `${b.start_date} ${b.start_ts ?? ''}`
      return aKey.localeCompare(bKey)
    })

    for (const item of sortedItems) {
      events.push(...buildEventLines(item, collectedTzids, tripMap.get(item.trip_id || '') ?? null))
    }
  }

  return buildCalendar(events, collectedTzids)
}
