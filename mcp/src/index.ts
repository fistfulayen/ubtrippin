#!/usr/bin/env node
/**
 * UBTRIPPIN MCP Server
 *
 * Exposes your UBTRIPPIN trip data as MCP tools and resources.
 * Works with Claude Desktop, Cursor, Windsurf, and any MCP-compatible client.
 *
 * Configuration:
 *   UBT_API_KEY   — Your UBTRIPPIN API key (from ubtrippin.xyz/settings)
 *   UBT_BASE_URL  — Optional: override base URL (default: https://ubtrippin.xyz)
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const API_KEY = process.env.UBT_API_KEY
const BASE_URL = (process.env.UBT_BASE_URL || 'https://ubtrippin.xyz').replace(/\/$/, '')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TripItem {
  id: string
  trip_id: string
  kind: string
  provider: string
  traveler_names: string[] | null
  start_ts: string | null
  end_ts: string | null
  start_date: string | null
  end_date: string | null
  start_location: string | null
  end_location: string | null
  summary: string | null
  details_json: Record<string, unknown> | null
  status: string | null
  confidence: number | null
  needs_review: boolean
}

interface Trip {
  id: string
  title: string
  start_date: string | null
  end_date: string | null
  primary_location: string | null
  travelers: string[] | null
  notes: string | null
  cover_image_url: string | null
  share_enabled: boolean
  created_at: string
  updated_at: string
}

interface TripWithItems extends Trip {
  items: TripItem[]
}

// ---------------------------------------------------------------------------
// API client helpers
// ---------------------------------------------------------------------------

function authHeaders(): Record<string, string> {
  if (!API_KEY) {
    throw new Error(
      'UBT_API_KEY is not set. Generate an API key at ubtrippin.xyz/settings and set it as UBT_API_KEY.'
    )
  }
  return {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    let errMsg = `API error ${res.status}`
    try {
      const json = JSON.parse(body) as { error?: { message?: string } }
      errMsg = json?.error?.message || errMsg
    } catch {}
    throw new Error(errMsg)
  }

  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// iCal generator (minimal — used by get_calendar tool)
// ---------------------------------------------------------------------------

function escapeIcal(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function toIcalDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD — return as all-day date
  return dateStr.replace(/-/g, '')
}

function toIcalDateTime(tsStr: string): string {
  // tsStr is ISO 8601 UTC — format as YYYYMMDDTHHMMSSZ
  return tsStr.replace(/[-:]/g, '').replace(/\.\d+/, '').replace(' ', 'T')
}

function generateTripIcal(trip: TripWithItems): string {
  const kindEmoji: Record<string, string> = {
    flight: '✈️',
    hotel: '🏨',
    train: '🚂',
    car: '🚗',
    ferry: '⛴️',
    activity: '🎭',
    other: '📌',
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UBTRIPPIN//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcal(trip.title)}`,
    'X-WR-CALDESC:UBTRIPPIN itinerary',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ]

  for (const item of trip.items) {
    const emoji = kindEmoji[item.kind] || '📌'
    const summary = item.summary || `${item.provider} ${item.kind}`
    const uid = `ubt-item-${item.id}@ubtrippin.xyz`

    let dtstart = ''
    let dtend = ''

    if (item.start_ts) {
      dtstart = `DTSTART:${toIcalDateTime(item.start_ts)}`
      dtend = `DTEND:${toIcalDateTime(item.end_ts || item.start_ts)}`
    } else if (item.start_date) {
      dtstart = `DTSTART;VALUE=DATE:${toIcalDate(item.start_date)}`
      const endDate = item.end_date || item.start_date
      // iCal all-day end is exclusive: add one day
      const d = new Date(endDate)
      d.setUTCDate(d.getUTCDate() + 1)
      dtend = `DTEND;VALUE=DATE:${d.toISOString().slice(0, 10).replace(/-/g, '')}`
    } else {
      continue // skip items with no date
    }

    const descParts: string[] = [`${emoji} ${item.provider}`]
    if (item.start_location) descParts.push(`From: ${item.start_location}`)
    if (item.end_location && item.end_location !== item.start_location) {
      descParts.push(`To: ${item.end_location}`)
    }
    if (item.traveler_names?.length) {
      descParts.push(`Travelers: ${item.traveler_names.join(', ')}`)
    }
    descParts.push(`View: ${BASE_URL}/trips/${trip.id}`)

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${uid}`)
    lines.push(`SUMMARY:${escapeIcal(`${emoji} ${summary}`)}`)
    lines.push(dtstart)
    lines.push(dtend)
    lines.push(`DESCRIPTION:${escapeIcal(descParts.join('\\n'))}`)
    if (item.start_location) {
      lines.push(`LOCATION:${escapeIcal(item.start_location)}`)
    }
    lines.push(`DTSTAMP:${toIcalDateTime(new Date().toISOString())}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer(
  { name: 'ubtrippin', version: '1.1.0' },
  {
    capabilities: { resources: {}, tools: {} },
    instructions: `
This server provides read-only access to your UBTRIPPIN travel data.
Requires UBT_API_KEY environment variable (from ubtrippin.xyz/settings).

Tools: list_trips, get_trip, get_item, search_trips, get_upcoming, get_calendar
Resources: ubtrippin://trips, ubtrippin://trips/{id}
    `.trim(),
  }
)

// ---------------------------------------------------------------------------
// Core Tools (Phase 1)
// ---------------------------------------------------------------------------

server.registerTool(
  'list_trips',
  {
    title: 'List Trips',
    description:
      'List all trips for the authenticated user, ordered by start date (soonest upcoming / most recent first).',
  },
  async () => {
    const result = await apiFetch<{ data: Trip[]; meta: { count: number } }>('/api/v1/trips')
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.registerTool(
  'get_trip',
  {
    title: 'Get Trip',
    description:
      'Get a single trip with all its items (flights, hotels, trains, etc.) by trip ID.',
    inputSchema: {
      trip_id: z.string().uuid().describe('The UUID of the trip to retrieve'),
    },
  },
  async ({ trip_id }) => {
    const result = await apiFetch<{ data: TripWithItems; meta: { item_count: number } }>(
      `/api/v1/trips/${trip_id}`
    )
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.registerTool(
  'get_item',
  {
    title: 'Get Item',
    description: 'Get a single trip item (flight, hotel, train, etc.) by item ID.',
    inputSchema: {
      item_id: z.string().uuid().describe('The UUID of the item to retrieve'),
    },
  },
  async ({ item_id }) => {
    const result = await apiFetch<{ data: TripItem }>(`/api/v1/items/${item_id}`)
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

// ---------------------------------------------------------------------------
// Enhanced Tools (Phase 2)
// ---------------------------------------------------------------------------

server.registerTool(
  'get_upcoming',
  {
    title: 'Get Upcoming Trips',
    description:
      'Return only future trips (start_date >= today), sorted by date ascending. Useful for "what do I have coming up?" questions.',
    inputSchema: {
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('Maximum number of trips to return (default: 10)'),
    },
  },
  async ({ limit = 10 }) => {
    const result = await apiFetch<{ data: Trip[]; meta: { count: number } }>('/api/v1/trips')
    const today = new Date().toISOString().split('T')[0]

    const upcoming = (result.data || [])
      .filter((t) => !t.start_date || t.start_date >= today)
      .sort((a, b) => {
        if (!a.start_date) return 1
        if (!b.start_date) return -1
        return a.start_date.localeCompare(b.start_date)
      })
      .slice(0, limit)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ data: upcoming, meta: { count: upcoming.length } }, null, 2),
        },
      ],
    }
  }
)

server.registerTool(
  'search_trips',
  {
    title: 'Search Trips',
    description:
      'Search trips by destination/location, date range, or traveler name. All parameters are optional and combined with AND logic.',
    inputSchema: {
      query: z
        .string()
        .optional()
        .describe('Text to search in trip title, primary location, and notes'),
      after: z
        .string()
        .optional()
        .describe('Return trips starting on or after this date (YYYY-MM-DD)'),
      before: z
        .string()
        .optional()
        .describe('Return trips starting on or before this date (YYYY-MM-DD)'),
      traveler: z
        .string()
        .optional()
        .describe('Filter by traveler name (partial match, case-insensitive)'),
    },
  },
  async ({ query, after, before, traveler }) => {
    const result = await apiFetch<{ data: Trip[]; meta: { count: number } }>('/api/v1/trips')
    let trips = result.data || []

    if (query) {
      const q = query.toLowerCase()
      trips = trips.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.primary_location?.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q)
      )
    }

    if (after) {
      trips = trips.filter((t) => t.start_date && t.start_date >= after)
    }

    if (before) {
      trips = trips.filter((t) => t.start_date && t.start_date <= before)
    }

    if (traveler) {
      const tv = traveler.toLowerCase()
      trips = trips.filter((t) => t.travelers?.some((name) => name.toLowerCase().includes(tv)))
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ data: trips, meta: { count: trips.length } }, null, 2),
        },
      ],
    }
  }
)

server.registerTool(
  'get_calendar',
  {
    title: 'Get Trip Calendar',
    description:
      'Generate an iCal (.ics) file for a trip. Returns the raw iCal text which can be saved as a .ics file or imported into any calendar app.',
    inputSchema: {
      trip_id: z.string().uuid().describe('The UUID of the trip to generate a calendar for'),
    },
  },
  async ({ trip_id }) => {
    const result = await apiFetch<{ data: TripWithItems; meta: { item_count: number } }>(
      `/api/v1/trips/${trip_id}`
    )
    const trip = result.data
    const ics = generateTripIcal(trip)

    return {
      content: [
        {
          type: 'text',
          text: ics,
        },
      ],
    }
  }
)

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

server.registerResource(
  'trips',
  'ubtrippin://trips',
  {
    title: 'All Trips',
    description: 'All trips for the authenticated UBTRIPPIN user.',
    mimeType: 'application/json',
  },
  async (_uri) => {
    const result = await apiFetch<{ data: Trip[]; meta: { count: number } }>('/api/v1/trips')
    return {
      contents: [
        {
          uri: 'ubtrippin://trips',
          mimeType: 'application/json',
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  }
)

server.registerResource(
  'trip-detail',
  new ResourceTemplate('ubtrippin://trips/{id}', { list: undefined }),
  {
    title: 'Trip Detail',
    description: 'Full detail for a single trip including all items.',
    mimeType: 'application/json',
  },
  async (uri, variables) => {
    const id = variables['id'] as string
    if (!id) throw new Error('Trip ID is required')
    const result = await apiFetch<{ data: TripWithItems; meta: { item_count: number } }>(
      `/api/v1/trips/${id}`
    )
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  }
)

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport()
await server.connect(transport)
