export type FlightItemLiveStatus =
  | 'on_time'
  | 'delayed'
  | 'cancelled'
  | 'diverted'
  | 'en_route'
  | 'boarding'
  | 'landed'
  | 'arrived'
  | 'unknown'

export interface FlightStatusResult {
  status: FlightItemLiveStatus
  delayMinutes: number | null
  gate: string | null
  terminal: string | null
  estimatedDeparture: string | null
  estimatedArrival: string | null
  actualDeparture: string | null
  actualArrival: string | null
  raw: Record<string, unknown>
}

export interface FlightLookup {
  ident: string
  date: string
}

export interface ExistingTripItemStatus {
  status: string | null
  previous_status: string | null
  status_changed_at: string | null
}

export interface TripItemStatusResponse {
  item_id: string
  status: FlightItemLiveStatus
  delay_minutes: number | null
  gate: string | null
  terminal: string | null
  platform: string | null
  estimated_departure: string | null
  estimated_arrival: string | null
  actual_departure: string | null
  actual_arrival: string | null
  source: string | null
  last_checked_at: string | null
  status_changed_at: string | null
  previous_status: FlightItemLiveStatus | null
  raw_response?: Record<string, unknown> | null
}

const FLIGHTAWARE_BASE_URL = 'https://aeroapi.flightaware.com/aeroapi'
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

function asBoolean(value: unknown): boolean {
  return value === true
}

function toIsoOrNull(value: unknown): string | null {
  const parsed = asString(value)
  if (!parsed) return null
  return Number.isNaN(Date.parse(parsed)) ? null : parsed
}

function diffMinutes(startIso: string, endIso: string): number | null {
  const startMs = Date.parse(startIso)
  const endMs = Date.parse(endIso)
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null
  return Math.max(0, Math.round((endMs - startMs) / 60_000))
}

function calculateDelayMinutes(flight: Record<string, unknown>): number | null {
  const departureDelaySeconds = asNumber(flight.delay_departure)
  if (departureDelaySeconds !== null) {
    return Math.max(0, Math.round(departureDelaySeconds / 60))
  }

  const scheduledOff = toIsoOrNull(flight.scheduled_off)
  const estimatedOff = toIsoOrNull(flight.estimated_off)
  if (scheduledOff && estimatedOff) {
    const diff = diffMinutes(scheduledOff, estimatedOff)
    if (diff !== null) return diff
  }

  const arrivalDelaySeconds = asNumber(flight.delay_arrival)
  if (arrivalDelaySeconds !== null) {
    return Math.max(0, Math.round(arrivalDelaySeconds / 60))
  }

  const scheduledOn = toIsoOrNull(flight.scheduled_on)
  const estimatedOn = toIsoOrNull(flight.estimated_on)
  if (scheduledOn && estimatedOn) {
    return diffMinutes(scheduledOn, estimatedOn)
  }

  return null
}

function mapFlightStatus(
  flight: Record<string, unknown>,
  delayMinutes: number | null
): FlightItemLiveStatus {
  if (asBoolean(flight.cancelled)) return 'cancelled'
  if (asBoolean(flight.diverted)) return 'diverted'

  const sourceStatus = asString(flight.status)
  if (!sourceStatus) return 'unknown'

  switch (sourceStatus.toLowerCase()) {
    case 'en route':
      return 'en_route'
    case 'landed':
      return 'arrived'
    case 'scheduled':
      return (delayMinutes ?? 0) > 0 ? 'delayed' : 'on_time'
    case 'unknown':
      return 'unknown'
    default:
      return 'unknown'
  }
}

export function extractFlightIdentFromDetails(detailsJson: unknown): string | null {
  const details = asRecord(detailsJson)
  if (!details) return null

  const rawFlightNumber = asString(details.flight_number)
  if (!rawFlightNumber) return null

  const normalized = rawFlightNumber.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (normalized.length < 3 || normalized.length > 8) return null
  if (!/[A-Z]/.test(normalized) || !/\d/.test(normalized)) return null
  return normalized
}

export function buildFlightLookup(item: {
  start_date: string | null
  details_json: unknown
}): FlightLookup | null {
  if (!item.start_date || !ISO_DATE_RE.test(item.start_date)) {
    return null
  }

  const ident = extractFlightIdentFromDetails(item.details_json)
  if (!ident) return null

  return {
    ident,
    date: item.start_date,
  }
}

export async function getFlightStatus(ident: string, date: string): Promise<FlightStatusResult | null> {
  if (!process.env.FLIGHTAWARE_API_KEY) {
    console.error('[flightaware] FLIGHTAWARE_API_KEY is not configured')
    return null
  }

  const start = `${date}T00:00:00Z`
  const end = `${date}T23:59:59Z`
  const url = `${FLIGHTAWARE_BASE_URL}/flights/${encodeURIComponent(ident)}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`

  try {
    const response = await fetch(url, {
      headers: { 'x-apikey': process.env.FLIGHTAWARE_API_KEY },
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error(`[flightaware] ${response.status} for ${ident}`)
      return null
    }

    const payload = await response.json()
    const root = asRecord(payload)
    const flights = Array.isArray(root?.flights) ? root.flights : []
    const first = asRecord(flights[0])
    if (!first) return null

    const delayMinutes = calculateDelayMinutes(first)

    return {
      status: mapFlightStatus(first, delayMinutes),
      delayMinutes,
      gate: asString(first.gate_origin) ?? asString(first.gate_destination),
      terminal: asString(first.terminal_origin) ?? asString(first.terminal_destination),
      estimatedDeparture: toIsoOrNull(first.estimated_off),
      estimatedArrival: toIsoOrNull(first.estimated_on),
      actualDeparture: toIsoOrNull(first.actual_off),
      actualArrival: toIsoOrNull(first.actual_on),
      raw: first,
    }
  } catch (error) {
    console.error('[flightaware] request failed:', error)
    return null
  }
}

function asLiveStatus(value: string | null | undefined): FlightItemLiveStatus | null {
  if (!value) return null
  if (
    value === 'on_time' ||
    value === 'delayed' ||
    value === 'cancelled' ||
    value === 'diverted' ||
    value === 'en_route' ||
    value === 'boarding' ||
    value === 'landed' ||
    value === 'arrived' ||
    value === 'unknown'
  ) {
    return value
  }
  return null
}

export function normalizeStatusRow(
  itemId: string,
  row: Record<string, unknown> | null | undefined
): TripItemStatusResponse {
  const status = asLiveStatus(asString(row?.status)) ?? 'unknown'

  return {
    item_id: itemId,
    status,
    delay_minutes: asNumber(row?.delay_minutes),
    gate: asString(row?.gate),
    terminal: asString(row?.terminal),
    platform: asString(row?.platform),
    estimated_departure: toIsoOrNull(row?.estimated_departure),
    estimated_arrival: toIsoOrNull(row?.estimated_arrival),
    actual_departure: toIsoOrNull(row?.actual_departure),
    actual_arrival: toIsoOrNull(row?.actual_arrival),
    source: asString(row?.source),
    last_checked_at: toIsoOrNull(row?.last_checked_at),
    status_changed_at: toIsoOrNull(row?.status_changed_at),
    previous_status: asLiveStatus(asString(row?.previous_status)),
    raw_response: asRecord(row?.raw_response),
  }
}

export function buildStatusUpsertValues(params: {
  itemId: string
  result: FlightStatusResult
  existing: ExistingTripItemStatus | null
}) {
  const nowIso = new Date().toISOString()
  const previous = asLiveStatus(params.existing?.status)
  const changed = previous !== null && previous !== params.result.status

  return {
    values: {
      item_id: params.itemId,
      status: params.result.status,
      delay_minutes: params.result.delayMinutes,
      gate: params.result.gate,
      terminal: params.result.terminal,
      platform: null,
      estimated_departure: params.result.estimatedDeparture,
      estimated_arrival: params.result.estimatedArrival,
      actual_departure: params.result.actualDeparture,
      actual_arrival: params.result.actualArrival,
      raw_response: params.result.raw,
      source: 'flightaware',
      last_checked_at: nowIso,
      status_changed_at: changed ? nowIso : params.existing?.status_changed_at ?? null,
      previous_status: changed ? previous : params.existing?.previous_status ?? null,
      updated_at: nowIso,
    },
    statusChanged: changed,
    previousStatus: changed ? previous : null,
  }
}
