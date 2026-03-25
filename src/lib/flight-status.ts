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
  // Rich flight data
  aircraftType: string | null
  tailNumber: string | null
  operator: string | null
  operatorIata: string | null
  codeshares: string[] | null
  departureGate: string | null
  departureTerminal: string | null
  arrivalGate: string | null
  arrivalTerminal: string | null
  baggageClaim: string | null
  inboundFaFlightId: string | null
  inboundOrigin: string | null
  inboundIdent: string | null
  inboundEstimatedIn: string | null
  actualOff: string | null
  actualOn: string | null
  actualOut: string | null
  actualIn: string | null
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
  // Rich flight data
  aircraft_type: string | null
  tail_number: string | null
  operator: string | null
  operator_iata: string | null
  codeshares: string[] | null
  departure_gate: string | null
  departure_terminal: string | null
  arrival_gate: string | null
  arrival_terminal: string | null
  baggage_claim: string | null
  inbound_fa_flight_id: string | null
  inbound_origin: string | null
  inbound_ident: string | null
  inbound_estimated_in: string | null
  actual_off: string | null
  actual_on: string | null
  actual_out: string | null
  actual_in: string | null
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

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const result = value.filter((v): v is string => typeof v === 'string' && v.length > 0)
  return result.length > 0 ? result : null
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

  // Prefer gate times (out) over takeoff times (off) for delay calculation
  // — passengers care about when they leave the gate, not wheels-up
  const scheduledOut = toIsoOrNull(flight.scheduled_out)
  const estimatedOut = toIsoOrNull(flight.estimated_out)
  if (scheduledOut && estimatedOut) {
    const diff = diffMinutes(scheduledOut, estimatedOut)
    if (diff !== null) return diff
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

  const normalized = sourceStatus.toLowerCase().trim()

  // Handle compound statuses like "Landed / Taxiing", "Landed / Gate Arrival"
  const primary = normalized.split('/')[0].trim()

  switch (primary) {
    case 'en route':
      return 'en_route'
    case 'landed':
      return 'arrived'
    case 'scheduled':
      return (delayMinutes ?? 0) > 0 ? 'delayed' : 'on_time'
    case 'delayed':
      return 'delayed'
    case 'taxiing':
      return 'en_route'
    case 'gate arrival':
      return 'arrived'
    case 'boarding':
      return 'boarding'
    case 'unknown':
      return 'unknown'
    default:
      const safe = (s: string) => s.replace(/[\r\n]/g, ' ').slice(0, 64)
      console.warn(`[flight-status] unmapped FA status: "${safe(sourceStatus)}" (primary: "${safe(primary)}")`)
      return 'unknown'
  }
}

// Common airline name → IATA code mapping for when flight_number is digits-only.
const AIRLINE_IATA: Record<string, string> = {
  'air france': 'AF',
  'air france hop': 'HOP',
  'hop': 'A5',
  'hop!': 'A5',
  'delta': 'DL',
  'united': 'UA',
  'american': 'AA',
  'american airlines': 'AA',
  'british airways': 'BA',
  'lufthansa': 'LH',
  'klm': 'KL',
  'easyjet': 'U2',
  'ryanair': 'FR',
  'vueling': 'VY',
  'iberia': 'IB',
  'swiss': 'LX',
  'austrian': 'OS',
  'transavia': 'TO',
  'alitalia': 'AZ',
  'ita airways': 'AZ',
  'tap': 'TP',
  'tap portugal': 'TP',
  'sas': 'SK',
  'finnair': 'AY',
  'turkish airlines': 'TK',
  'emirates': 'EK',
  'qatar': 'QR',
  'qatar airways': 'QR',
  'etihad': 'EY',
  'singapore airlines': 'SQ',
  'cathay pacific': 'CX',
  'ana': 'NH',
  'jal': 'JL',
  'japan airlines': 'JL',
  'korean air': 'KE',
  'spirit': 'NK',
  'spirit airlines': 'NK',
  'jetblue': 'B6',
  'jetblue airways': 'B6',
  'southwest': 'WN',
  'southwest airlines': 'WN',
  'frontier': 'F9',
  'frontier airlines': 'F9',
  'alaska': 'AS',
  'alaska airlines': 'AS',
  'norwegian': 'DY',
  'wizz air': 'W6',
  'volotea': 'V7',
  'aer lingus': 'EI',
}

function guessIataFromAirline(details: Record<string, unknown>): string | null {
  // Try airline_code field first (IATA directly)
  const code = asString(details.airline_code) || asString(details.carrier_code)
  if (code && /^[A-Z0-9]{2}$/i.test(code.trim())) {
    return code.trim().toUpperCase()
  }
  // Fall back to airline name lookup
  const airline = asString(details.airline)
  if (!airline) return null
  return AIRLINE_IATA[airline.toLowerCase().trim()] ?? null
}

export function extractFlightIdentFromDetails(detailsJson: unknown): string | null {
  const details = asRecord(detailsJson)
  if (!details) return null

  const rawFlightNumber = asString(details.flight_number)
  if (!rawFlightNumber) return null

  const normalized = rawFlightNumber.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (normalized.length < 2 || normalized.length > 8) return null
  if (!/\d/.test(normalized)) return null

  // If flight number is digits-only (e.g. "1103"), prepend airline IATA code
  if (!/[A-Z]/.test(normalized)) {
    const iata = guessIataFromAirline(details)
    if (!iata) return null
    const withPrefix = iata + normalized
    if (withPrefix.length > 8) return null
    return withPrefix
  }

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

async function fetchFlightsRaw(ident: string, date: string): Promise<Record<string, unknown>[] | null> {
  if (!process.env.FLIGHTAWARE_API_KEY) {
    console.error('[flightaware] FLIGHTAWARE_API_KEY is not configured')
    return null
  }

  const start = `${date}T00:00:00Z`
  const endOfWindow = new Date(`${date}T00:00:00Z`)
  endOfWindow.setUTCHours(endOfWindow.getUTCHours() + 36)
  const maxEnd = new Date(Date.now() + 47 * 60 * 60 * 1000)
  const endDate = endOfWindow < maxEnd ? endOfWindow : maxEnd
  const end = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z')
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
    if (flights.length === 0) return null

    return flights.map((f) => asRecord(f)).filter((f): f is Record<string, unknown> => f !== null)
  } catch (error) {
    console.error('[flightaware] request failed:', error)
    return null
  }
}

function pickBestFlight(flights: Record<string, unknown>[]): Record<string, unknown> | null {
  if (flights.length === 0) return null

  // Prefer not-yet-arrived over completed
  let best: Record<string, unknown> | null = null
  for (const rec of flights) {
    const status = asString(rec.status)?.toLowerCase() ?? ''
    const progress = asNumber(rec.progress_percent)
    if (!status.startsWith('landed') && progress !== 100) {
      best = rec
      break
    }
  }
  // If all flights are completed, fall back to the last one (most recent)
  if (!best) {
    best = flights[flights.length - 1] ?? null
  }
  return best
}

export async function getFlightStatus(ident: string, date: string): Promise<FlightStatusResult | null> {
  let flights = await fetchFlightsRaw(ident, date)
  if (!flights || flights.length === 0) return null

  let first = pickBestFlight(flights)
  if (!first) return null

  // Codeshare resolution: if the queried ident is a codeshare, FA returns
  // the operating flight's ident_iata. Re-fetch with that for fresher data.
  const operatorIdent = asString(first.ident_iata) ?? asString(first.ident)
  if (operatorIdent && operatorIdent.toUpperCase() !== ident.toUpperCase()) {
    console.log(`[flightaware] codeshare detected: ${ident} → operating as ${operatorIdent}, re-fetching`)
    const operatorFlights = await fetchFlightsRaw(operatorIdent, date)
    if (operatorFlights && operatorFlights.length > 0) {
      const operatorBest = pickBestFlight(operatorFlights)
      if (operatorBest) first = operatorBest
    }
  }

  try {

    const delayMinutes = calculateDelayMinutes(first)

    // Extract inbound flight info if present (FA may return an inbound object with origin/ident/eta)
    const inbound = asRecord(first.inbound)

    return {
      status: mapFlightStatus(first, delayMinutes),
      delayMinutes,
      gate: asString(first.gate_origin) ?? null,
      terminal: asString(first.terminal_origin) ?? null,
      // Prefer estimated_out (gate departure — what passengers see) over
      // estimated_off (wheels-up takeoff time). The booking email shows gate
      // departure, so the live update should match.
      estimatedDeparture: toIsoOrNull(first.estimated_out) ?? toIsoOrNull(first.estimated_off),
      estimatedArrival: toIsoOrNull(first.estimated_on),
      actualDeparture: toIsoOrNull(first.actual_off),
      actualArrival: toIsoOrNull(first.actual_on),
      // Rich flight data
      aircraftType: asString(first.aircraft_type),
      tailNumber: asString(first.registration),
      operator: asString(first.operator),
      operatorIata: asString(first.operator_iata),
      codeshares: asStringArray(first.codeshares),
      departureGate: asString(first.gate_origin),
      departureTerminal: asString(first.terminal_origin),
      arrivalGate: asString(first.gate_destination),
      arrivalTerminal: asString(first.terminal_destination),
      baggageClaim: asString(first.baggage_claim),
      inboundFaFlightId: asString(first.inbound_fa_flight_id),
      inboundOrigin: inbound ? asString(inbound.origin) : null,
      inboundIdent: inbound ? (asString(inbound.ident_iata) ?? asString(inbound.ident)) : null,
      inboundEstimatedIn: inbound ? toIsoOrNull(inbound.estimated_in) : null,
      actualOff: toIsoOrNull(first.actual_off),
      actualOn: toIsoOrNull(first.actual_on),
      actualOut: toIsoOrNull(first.actual_out),
      actualIn: toIsoOrNull(first.actual_in),
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
    // Rich flight data
    aircraft_type: asString(row?.aircraft_type),
    tail_number: asString(row?.tail_number),
    operator: asString(row?.operator),
    operator_iata: asString(row?.operator_iata),
    codeshares: asStringArray(row?.codeshares),
    departure_gate: asString(row?.departure_gate),
    departure_terminal: asString(row?.departure_terminal),
    arrival_gate: asString(row?.arrival_gate),
    arrival_terminal: asString(row?.arrival_terminal),
    baggage_claim: asString(row?.baggage_claim),
    inbound_fa_flight_id: asString(row?.inbound_fa_flight_id),
    inbound_origin: asString(row?.inbound_origin),
    inbound_ident: asString(row?.inbound_ident),
    inbound_estimated_in: toIsoOrNull(row?.inbound_estimated_in),
    actual_off: toIsoOrNull(row?.actual_off),
    actual_on: toIsoOrNull(row?.actual_on),
    actual_out: toIsoOrNull(row?.actual_out),
    actual_in: toIsoOrNull(row?.actual_in),
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
      // Rich flight data
      aircraft_type: params.result.aircraftType,
      tail_number: params.result.tailNumber,
      operator: params.result.operator,
      operator_iata: params.result.operatorIata,
      codeshares: params.result.codeshares,
      departure_gate: params.result.departureGate,
      departure_terminal: params.result.departureTerminal,
      arrival_gate: params.result.arrivalGate,
      arrival_terminal: params.result.arrivalTerminal,
      baggage_claim: params.result.baggageClaim,
      inbound_fa_flight_id: params.result.inboundFaFlightId,
      inbound_origin: params.result.inboundOrigin,
      inbound_ident: params.result.inboundIdent,
      inbound_estimated_in: params.result.inboundEstimatedIn,
      actual_off: params.result.actualOff,
      actual_on: params.result.actualOn,
      actual_out: params.result.actualOut,
      actual_in: params.result.actualIn,
    },
    statusChanged: changed,
    previousStatus: changed ? previous : null,
  }
}
