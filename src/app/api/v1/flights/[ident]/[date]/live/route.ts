import { NextResponse } from 'next/server'

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
  const scheduledOut = asString(flight.scheduled_out)
  const estimatedOut = asString(flight.estimated_out)
  
  if (!scheduledOut || !estimatedOut) return null
  
  try {
    const sched = new Date(scheduledOut).getTime()
    const est = new Date(estimatedOut).getTime()
    const delayMs = est - sched
    if (delayMs <= 0) return null
    return Math.round(delayMs / 60000)
  } catch {
    return null
  }
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

async function fetchFlightFromAware(ident: string, date: string): Promise<FlightApiResponse | null> {
  if (!process.env.FLIGHTAWARE_API_KEY) {
    console.error('[flightaware] FLIGHTAWARE_API_KEY is not configured')
    return null
  }

  const start = `${date}T00:00:00Z`
  const endOfDay = new Date(`${date}T23:59:59Z`)
  const maxEnd = new Date(Date.now() + 47 * 60 * 60 * 1000)
  const endDate = endOfDay < maxEnd ? endOfDay : maxEnd
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

    const payload = await response.json() as Record<string, unknown>
    const flights = Array.isArray(payload?.flights) ? payload.flights : []
    const first = flights[0] as Record<string, unknown> | undefined
    if (!first) return null

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
