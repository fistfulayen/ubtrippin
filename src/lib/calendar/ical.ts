import type { Trip, TripItem, Json } from '@/types/database'

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

function localDateTime(date: string | null, localTime: string | null, fallbackIso: string | null): string | null {
  const normalized = normalizeTime(localTime)
  if (date && normalized) {
    return `${date.replace(/-/g, '')}T${normalized}`
  }
  return isoToFloatingDateTime(fallbackIso)
}

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

function buildEventLines(item: TripItem, trip?: Trip | null): string[] {
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
  } else if (item.kind === 'flight') {
    const startLocal = localDateTime(
      item.start_date,
      (details.departure_local_time as string | undefined) || null,
      item.start_ts
    )
    const endDate = item.end_date || item.start_date
    const endLocal = localDateTime(
      endDate,
      (details.arrival_local_time as string | undefined) || null,
      item.end_ts
    )

    lines.push(`SUMMARY:${escapeIcsText(buildFlightSummary(item, details))}`)

    if (startLocal) lines.push(`DTSTART:${startLocal}`)
    else lines.push(`DTSTART;VALUE=DATE:${toDateValue(item.start_date)}`)

    if (endLocal) lines.push(`DTEND:${endLocal}`)
    else if (item.end_date) lines.push(`DTEND;VALUE=DATE:${toDateValue(addDays(item.end_date, 1))}`)
    else lines.push(`DTEND;VALUE=DATE:${toDateValue(addDays(item.start_date, 1))}`)

    const location = buildFlightLocation(item, details)
    if (location) lines.push(`LOCATION:${escapeIcsText(location)}`)
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

function buildCalendar(events: string[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PROD_ID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(CALENDAR_NAME)}`,
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

  const events: string[] = []
  events.push(...buildTripSpanEvent(trip))
  for (const item of sorted) {
    events.push(...buildEventLines(item, trip))
  }

  return buildCalendar(events)
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
      events.push(...buildEventLines(item, tripMap.get(item.trip_id || '') ?? null))
    }
  }

  return buildCalendar(events)
}
