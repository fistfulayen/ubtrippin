import { NextResponse } from 'next/server'
import { buildFlightAwareDateWindow, pickBestFlight } from '@/lib/flight-status'

// Simple in-memory cache: key -> { data, fetchedAt }
const cache = new Map<string, { data: unknown; fetchedAt: number }>()
const CACHE_MS = 5 * 60 * 1000 // 5 minutes

// Rate limiting: IP -> { count, windowStart }
const rateLimit = new Map<string, { count: number; windowStart: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 60 // 60 requests per minute per IP

const FLIGHTAWARE_BASE_URL = 'https://aeroapi.flightaware.com/aeroapi'

function getClientIp(request: Request): string {
  const headers = request.headers
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  return 'unknown'
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimit.get(ip)
  
  if (!entry) {
    rateLimit.set(ip, { count: 1, windowStart: now })
    return false
  }
  
  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimit.set(ip, { count: 1, windowStart: now })
    return false
  }
  
  entry.count++
  if (entry.count > RATE_LIMIT_MAX) {
    return true
  }
  return false
}

function isValidIdent(ident: string): boolean {
  const match = ident.match(/^[A-Za-z0-9]{1,4}\d{1,4}$/)
  return match !== null
}

function isValidDate(date: string): boolean {
  const match = date.match(/^\d{4}-\d{2}-\d{2}$/)
  if (!match) return false
  
  const d = new Date(date)
  if (isNaN(d.getTime())) return false
  
  const parts = date.split('-')
  return (
    d.getUTCFullYear() === parseInt(parts[0], 10) &&
    d.getUTCMonth() + 1 === parseInt(parts[1], 10) &&
    d.getUTCDate() === parseInt(parts[2], 10)
  )
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value
  return null
}

function toIsoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  try {
    const d = new Date(value)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
  } catch {
    return null
  }
}

function calculateDelayMinutes(flight: Record<string, unknown>): number | null {
  // Prefer arrival delay (scheduled_on vs estimated_on) — this is what passengers care about.
  // Fall back to departure delay (scheduled_off vs estimated_off) if arrival times not available.
  const pairs: Array<[string, string]> = [
    ['scheduled_on', 'estimated_on'],
    ['scheduled_off', 'estimated_off'],
    ['scheduled_out', 'estimated_out'],
  ]
  
  for (const [schedKey, estKey] of pairs) {
    const sched = asString(flight[schedKey])
    const est = asString(flight[estKey])
    if (!sched || !est) continue
    try {
      const schedMs = new Date(sched).getTime()
      const estMs = new Date(est).getTime()
      const delayMs = estMs - schedMs
      if (delayMs > 60000) return Math.round(delayMs / 60000) // only count delays > 1 min
    } catch { /* continue */ }
  }
  return null
}

/** Return IATA code if available, otherwise ICAO as-is. No heuristic stripping. */
function toDisplayCode(icao: string | null, iata: string | null): string {
  if (iata) return iata
  return icao ?? ''
}

function mapFlightStatus(
  flight: Record<string, unknown>,
  delayMinutes: number | null
): string {
  const cancelled = flight.cancelled
  if (cancelled === true || cancelled === 'true') return 'cancelled'
  
  const diverted = flight.diverted
  if (diverted === true || diverted === 'true') return 'diverted'
  
  const actualOn = asString(flight.actual_on)
  const actualIn = asString(flight.actual_in)
  if (actualOn || actualIn) return 'landed'
  
  const actualOff = asString(flight.actual_off)
  if (actualOff) return 'en_route'

  // Left the gate but not yet airborne → taxiing
  const actualOut = asString(flight.actual_out)
  if (actualOut) return 'taxiing'
  
  if (delayMinutes && delayMinutes > 0) return 'delayed'
  
  return 'on_time'
}

interface FlightApiResponse {
  flight: {
    ident: string
    airline: string | null
    origin: {
      code: string
      city: string | null
      name: string | null
      gate: string | null
      terminal: string | null
      timezone: string | null
    }
    destination: {
      code: string
      city: string | null
      name: string | null
      gate: string | null
      terminal: string | null
      timezone: string | null
    }
    scheduled_departure: string | null
    estimated_departure: string | null
    actual_departure: string | null
    scheduled_arrival: string | null
    estimated_arrival: string | null
    actual_arrival: string | null
    status: string
    delay_minutes: number | null
    aircraft_type: string | null
    progress_percent: number | null
  }
  cached: boolean
  last_updated: string
}

// IATA airline codes that contain digits (FA can't resolve them directly).
// Map: IATA prefix → ICAO prefix for FlightAware lookup.
const IATA_TO_ICAO_PREFIX: Record<string, string> = {
  'U2': 'EZY',  // easyJet
  'W6': 'WZZ',  // Wizz Air
  'FR': 'RYR',  // Ryanair (IATA=FR works, but ICAO=RYR sometimes needed)
  'U5': 'GWY',  // USA3000 (legacy)
}

/**
 * Given an IATA ident like "U28377", return the ICAO equivalent "EZY8377"
 * if the airline prefix is in our digit-prefix map. Otherwise returns null.
 */
function toIcaoIdent(iataIdent: string): string | null {
  for (const [iataPrefix, icaoPrefix] of Object.entries(IATA_TO_ICAO_PREFIX)) {
    if (iataIdent.toUpperCase().startsWith(iataPrefix)) {
      const flightNum = iataIdent.slice(iataPrefix.length)
      return icaoPrefix + flightNum
    }
  }
  return null
}

async function fetchFlightRaw(ident: string, date: string): Promise<Record<string, unknown>[] | null> {
  if (!process.env.FLIGHTAWARE_API_KEY) {
    console.error('[flightaware] FLIGHTAWARE_API_KEY is not configured')
    return null
  }

  const { start, end } = buildFlightAwareDateWindow(date)

  const fetchIdent = async (id: string): Promise<Record<string, unknown>[] | null> => {
    const url = `${FLIGHTAWARE_BASE_URL}/flights/${encodeURIComponent(id)}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    try {
      const response = await fetch(url, {
        headers: { 'x-apikey': process.env.FLIGHTAWARE_API_KEY! },
        cache: 'no-store',
      })
      if (!response.ok) {
        console.error(`[flightaware] ${response.status} for ${id}`)
        return null
      }
      const payload = await response.json() as Record<string, unknown>
      const flights = Array.isArray(payload?.flights) ? payload.flights as Record<string, unknown>[] : []
      return flights.length > 0 ? flights : null
    } catch (error) {
      console.error('[flightaware] request failed:', error)
      return null
    }
  }

  // Primary lookup
  const flights = await fetchIdent(ident)
  if (flights) return flights

  // Fallback: try ICAO ident for airlines with digit-containing IATA codes (e.g. U2 → EZY)
  const icaoIdent = toIcaoIdent(ident)
  if (icaoIdent) {
    console.log(`[flightaware] empty result for ${ident}, retrying with ICAO ident ${icaoIdent}`)
    return await fetchIdent(icaoIdent)
  }

  return null
}

async function fetchFlightFromAware(ident: string, date: string): Promise<FlightApiResponse | null> {
  let flights = await fetchFlightRaw(ident, date)
  if (!flights) return null

  // Pick the best flight first so we can check for codeshare resolution
  let first = pickBestFlight(flights)
  if (!first) return null

  // Codeshare resolution: if the queried ident is a codeshare and FA returns
  // an operating flight with a different ident, re-fetch using the operator's
  // ident for fresher, more accurate status data.
  const operatorIdent = asString(first.ident_iata) ?? asString(first.ident)
  if (operatorIdent && operatorIdent.toUpperCase() !== ident.toUpperCase()) {
    console.log(`[flightaware] codeshare detected: ${ident} → operating as ${operatorIdent}, re-fetching`)
    const operatorFlights = await fetchFlightRaw(operatorIdent, date)
    if (operatorFlights && operatorFlights.length > 0) {
      flights = operatorFlights
      first = pickBestFlight(flights) ?? first
    }
  }

  try {
    const delayMinutes = calculateDelayMinutes(first)
    const status = mapFlightStatus(first, delayMinutes)
    
    const origin = first.origin as Record<string, unknown> | undefined
    const destination = first.destination as Record<string, unknown> | undefined

    return {
      flight: {
        ident: asString(first.ident_iata) ?? asString(first.ident) ?? ident,
        airline: asString(first.operator) ?? asString(first.operator_iata) ?? null,
        origin: {
          code: toDisplayCode(asString(origin?.code), asString(origin?.code_iata)),
          city: asString(origin?.city) ?? null,
          name: asString(origin?.airport_name) ?? asString(origin?.name) ?? null,
          gate: asString(first.gate_origin) ?? null,
          terminal: asString(first.terminal_origin) ?? null,
          timezone: asString(origin?.timezone) ?? null,
        },
        destination: {
          code: toDisplayCode(asString(destination?.code), asString(destination?.code_iata)),
          city: asString(destination?.city) ?? null,
          name: asString(destination?.airport_name) ?? asString(destination?.name) ?? null,
          gate: asString(first.gate_destination) ?? null,
          terminal: asString(first.terminal_destination) ?? null,
          timezone: asString(destination?.timezone) ?? null,
        },
        scheduled_departure: toIsoOrNull(first.scheduled_out),
        estimated_departure: toIsoOrNull(first.estimated_out) ?? toIsoOrNull(first.estimated_off),
        actual_departure: toIsoOrNull(first.actual_off),
        scheduled_arrival: toIsoOrNull(first.scheduled_on),
        estimated_arrival: toIsoOrNull(first.estimated_on),
        actual_arrival: toIsoOrNull(first.actual_on),
        status,
        delay_minutes: delayMinutes,
        aircraft_type: asString(first.aircraft_type) ?? null,
        progress_percent: null, // FA doesn't provide this directly
      },
      cached: false,
      last_updated: new Date().toISOString(),
    }
  } catch (error) {
    console.error('[flightaware] request failed:', error)
    return null
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ident: string; date: string }> }
) {
  const { ident: rawIdent, date: rawDate } = await params
  const ident = rawIdent.toUpperCase()
  const date = rawDate

  // Rate limiting
  const clientIp = getClientIp(request)
  if (isRateLimited(clientIp)) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Too many requests. Please try again later.' } },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  // Validation
  if (!isValidIdent(ident)) {
    return NextResponse.json(
      { error: { code: 'invalid_ident', message: 'Invalid flight identifier. Expected format: NK2893, AA100, etc.' } },
      { status: 400 }
    )
  }

  if (!isValidDate(date)) {
    return NextResponse.json(
      { error: { code: 'invalid_date', message: 'Invalid date. Expected format: YYYY-MM-DD' } },
      { status: 400 }
    )
  }

  const cacheKey = `${ident}:${date}`
  const now = Date.now()

  // Check cache
  const cached = cache.get(cacheKey)
  if (cached && now - cached.fetchedAt < CACHE_MS) {
    const response = { ...(cached.data as FlightApiResponse), cached: true }
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300',
        'X-Cache': 'HIT',
      },
    })
  }

  // Fetch from FlightAware
  const result = await fetchFlightFromAware(ident, date)

  if (!result) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Flight not found. Double-check the flight number and date.' } },
      { status: 404 }
    )
  }

  // Store in cache
  cache.set(cacheKey, { data: result, fetchedAt: now })

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=300',
      'X-Cache': 'MISS',
    },
  })
}
