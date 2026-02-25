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
const BASE_URL = (process.env.UBT_BASE_URL || 'https://www.ubtrippin.xyz').replace(/\/$/, '')

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

interface CityGuide {
  id: string
  city: string
  country: string | null
  country_code: string | null
  is_public: boolean
  share_token: string | null
  entry_count: number
  created_at: string
  updated_at: string
}

interface GuideEntry {
  id: string
  guide_id: string
  name: string
  category: string
  status: 'visited' | 'to_try'
  description: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  website_url: string | null
  rating: number | null
  recommended_by: string | null
  tags: string[]
  source: string
  created_at: string
}

interface CityGuideWithEntries extends CityGuide {
  entries: GuideEntry[]
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
  { name: 'ubtrippin', version: '1.5.0' },
  {
    capabilities: { resources: {}, tools: {} },
    instructions: `
This server provides access to your UBTRIPPIN travel data and city guides.
Requires UBT_API_KEY environment variable (from ubtrippin.xyz/settings).

Read: list_trips, get_trip, get_item, search_trips, get_upcoming, get_calendar
Write (trips): create_trip, update_trip, delete_trip, merge_trips
Write (items): add_item, add_items, update_item, delete_item, move_item
City Guides: list_guides, get_guide, add_guide_entry, update_guide_entry, get_guide_markdown, get_nearby_places
Collaboration: list_collaborators, invite_collaborator, update_collaborator_role, remove_collaborator
Notifications: get_notifications, mark_notification_read
Settings: get_calendar_url, regenerate_calendar_token, list_senders, add_sender, delete_sender
Cover images: search_cover_image (then set via update_trip.cover_image_url)
Resources: ubtrippin://trips, ubtrippin://trips/{id}, ubtrippin://guides, ubtrippin://guides/{id}

Collaborative trips appear automatically in list_trips — trips where you are owner or accepted collaborator.
The role field in trip data indicates your access level: "owner", "editor", or "viewer".
Editors can add/update items; viewers can read only; owner has full control.
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
// Write Tools — Trips
// ---------------------------------------------------------------------------

server.registerTool(
  'create_trip',
  {
    title: 'Create Trip',
    description: `Create a new trip. Returns the created trip with its assigned ID.

Example:
  create_trip({ title: "Paris → New York", start_date: "2026-06-07", end_date: "2026-06-07", primary_location: "New York" })`,
    inputSchema: {
      title: z.string().min(1).max(200).describe('Trip title (required, 1–200 chars)'),
      start_date: z.string().optional().describe('Start date YYYY-MM-DD'),
      end_date: z.string().optional().describe('End date YYYY-MM-DD'),
      primary_location: z.string().optional().describe('Main destination (e.g. "Tokyo, Japan")'),
      notes: z.string().optional().describe('Free-text notes'),
    },
  },
  async (input) => {
    const res = await fetch(`${BASE_URL}/api/v1/trips`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(input),
    })
    const result = await res.json()
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.registerTool(
  'update_trip',
  {
    title: 'Update Trip',
    description: `Update fields on an existing trip. All fields are optional — only provided fields are updated.

Example:
  update_trip({ trip_id: "...", title: "NYC June", share_enabled: true })`,
    inputSchema: {
      trip_id: z.string().uuid().describe('UUID of the trip to update'),
      title: z.string().min(1).max(200).optional().describe('New title'),
      start_date: z.string().nullable().optional().describe('New start date YYYY-MM-DD (null to clear)'),
      end_date: z.string().nullable().optional().describe('New end date YYYY-MM-DD (null to clear)'),
      primary_location: z.string().nullable().optional().describe('New primary location (null to clear)'),
      notes: z.string().nullable().optional().describe('New notes (null to clear)'),
      cover_image_url: z.string().nullable().optional().describe('New cover image URL (null to clear)'),
      share_enabled: z.boolean().optional().describe('Enable or disable public share link'),
    },
  },
  async ({ trip_id, ...updates }) => {
    const res = await fetch(`${BASE_URL}/api/v1/trips/${trip_id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    })
    const result = await res.json()
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.registerTool(
  'delete_trip',
  {
    title: 'Delete Trip',
    description: `Delete a trip and ALL its items. This is irreversible. Confirm with the user before calling.

Returns: { deleted: true } on success.`,
    inputSchema: {
      trip_id: z.string().uuid().describe('UUID of the trip to delete'),
    },
  },
  async ({ trip_id }) => {
    const res = await fetch(`${BASE_URL}/api/v1/trips/${trip_id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (res.status === 204) {
      return { content: [{ type: 'text', text: JSON.stringify({ deleted: true, trip_id }) }] }
    }
    const result = await res.json()
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  }
)

// ---------------------------------------------------------------------------
// Write Tools — Items
// ---------------------------------------------------------------------------

server.registerTool(
  'add_item',
  {
    title: 'Add Item to Trip',
    description: `Add a single travel item to a trip. The API is strict — all parsing and field extraction is your responsibility. Required: kind + start_date.

Valid kinds: flight, hotel, car_rental, train, activity, restaurant, other

Example (flight):
  add_item({
    trip_id: "...",
    kind: "flight",
    provider: "DL",
    summary: "Delta DL 263 CDG → JFK",
    start_date: "2026-06-07",
    start_ts: "2026-06-07T09:30:00Z",
    end_ts: "2026-06-07T17:46:00Z",
    start_location: "Paris CDG Terminal 2E",
    end_location: "New York JFK Terminal 4",
    traveler_names: ["Ian Rogers"],
    details_json: { flight_number: "DL 263", cabin_class: "Premium Economy" }
  })`,
    inputSchema: {
      trip_id: z.string().uuid().describe('UUID of the trip'),
      kind: z.enum(['flight', 'hotel', 'car_rental', 'train', 'activity', 'restaurant', 'other']).describe('Item type (required)'),
      start_date: z.string().describe('Start date YYYY-MM-DD (required)'),
      end_date: z.string().optional().describe('End date YYYY-MM-DD'),
      provider: z.string().optional().describe('Airline, hotel, car company, etc.'),
      confirmation_code: z.string().optional().describe('Booking confirmation code'),
      summary: z.string().optional().describe('Human-readable one-liner'),
      traveler_names: z.array(z.string()).optional().describe('Names of travelers on this item'),
      start_ts: z.string().optional().describe('Start datetime ISO 8601 UTC'),
      end_ts: z.string().optional().describe('End datetime ISO 8601 UTC'),
      start_location: z.string().optional().describe('Departure / check-in location'),
      end_location: z.string().optional().describe('Arrival / check-out location'),
      details_json: z.record(z.string(), z.unknown()).optional().describe('Type-specific structured data (max 10KB)'),
      status: z.string().optional().describe('confirmed, pending, cancelled, etc.'),
    },
  },
  async ({ trip_id, ...itemBody }) => {
    const res = await fetch(`${BASE_URL}/api/v1/trips/${trip_id}/items`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(itemBody),
    })
    const result = await res.json()
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.registerTool(
  'add_items',
  {
    title: 'Add Multiple Items to Trip (Batch)',
    description: `Add up to 50 items to a trip in one call. Each item follows the same schema as add_item. Useful when importing a full itinerary at once.

Body: { trip_id, items: [ <item>, ... ] }`,
    inputSchema: {
      trip_id: z.string().uuid().describe('UUID of the trip'),
      items: z.array(z.object({
        kind: z.enum(['flight', 'hotel', 'car_rental', 'train', 'activity', 'restaurant', 'other']),
        start_date: z.string(),
        end_date: z.string().optional(),
        provider: z.string().optional(),
        confirmation_code: z.string().optional(),
        summary: z.string().optional(),
        traveler_names: z.array(z.string()).optional(),
        start_ts: z.string().optional(),
        end_ts: z.string().optional(),
        start_location: z.string().optional(),
        end_location: z.string().optional(),
        details_json: z.record(z.string(), z.unknown()).optional(),
        status: z.string().optional(),
      })).min(1).max(50).describe('Array of items to add (1–50)'),
    },
  },
  async ({ trip_id, items }) => {
    const res = await fetch(`${BASE_URL}/api/v1/trips/${trip_id}/items/batch`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ items }),
    })
    const result = await res.json()
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.registerTool(
  'update_item',
  {
    title: 'Update Trip Item',
    description: `Update fields on an existing trip item. All fields optional — only provided fields are updated.

Example: update_item({ item_id: "...", status: "cancelled" })`,
    inputSchema: {
      item_id: z.string().uuid().describe('UUID of the item to update'),
      kind: z.enum(['flight', 'hotel', 'car_rental', 'train', 'activity', 'restaurant', 'other']).optional(),
      start_date: z.string().nullable().optional(),
      end_date: z.string().nullable().optional(),
      provider: z.string().nullable().optional(),
      summary: z.string().nullable().optional(),
      traveler_names: z.array(z.string()).nullable().optional(),
      start_ts: z.string().nullable().optional(),
      end_ts: z.string().nullable().optional(),
      start_location: z.string().nullable().optional(),
      end_location: z.string().nullable().optional(),
      details_json: z.record(z.string(), z.unknown()).nullable().optional(),
      status: z.string().nullable().optional(),
      needs_review: z.boolean().nullable().optional(),
    },
  },
  async ({ item_id, ...updates }) => {
    const res = await fetch(`${BASE_URL}/api/v1/items/${item_id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    })
    const result = await res.json()
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.registerTool(
  'delete_item',
  {
    title: 'Delete Trip Item',
    description: `Delete a single trip item. The parent trip is not affected.

Returns: { deleted: true } on success.`,
    inputSchema: {
      item_id: z.string().uuid().describe('UUID of the item to delete'),
    },
  },
  async ({ item_id }) => {
    const res = await fetch(`${BASE_URL}/api/v1/items/${item_id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (res.status === 204) {
      return { content: [{ type: 'text', text: JSON.stringify({ deleted: true, item_id }) }] }
    }
    const result = await res.json()
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  }
)

// ---------------------------------------------------------------------------
// City Guide Tools (Phase 3)
// ---------------------------------------------------------------------------

server.registerTool(
  'list_guides',
  {
    title: 'List City Guides',
    description:
      'List all city guides for the authenticated user. Use city parameter to find a specific city guide.',
    inputSchema: {
      city: z
        .string()
        .optional()
        .describe('Filter by city name (partial match, case-insensitive)'),
    },
  },
  async ({ city }) => {
    const qs = city ? `?city=${encodeURIComponent(city)}` : ''
    const result = await apiFetch<{ data: CityGuide[]; meta: { count: number } }>(
      `/api/v1/guides${qs}`
    )
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.registerTool(
  'get_guide',
  {
    title: 'Get City Guide',
    description:
      'Get a city guide with all its entries (places). Returns visited and to-try entries grouped by category.',
    inputSchema: {
      guide_id: z.string().uuid().describe('The UUID of the guide to retrieve'),
    },
  },
  async ({ guide_id }) => {
    const result = await apiFetch<{ data: CityGuideWithEntries; meta: { entry_count: number } }>(
      `/api/v1/guides/${guide_id}`
    )
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.registerTool(
  'get_guide_markdown',
  {
    title: 'Get City Guide as Markdown',
    description:
      'Get a city guide formatted as clean Markdown — useful for reading, summarizing, or including in documents. Entries grouped by category.',
    inputSchema: {
      guide_id: z.string().uuid().describe('The UUID of the guide'),
    },
  },
  async ({ guide_id }) => {
    const text = await fetch(`${BASE_URL}/api/v1/guides/${guide_id}?format=md`, {
      headers: authHeaders(),
    }).then((r) => r.text())

    return {
      content: [{ type: 'text', text }],
    }
  }
)

server.registerTool(
  'add_guide_entry',
  {
    title: 'Add Place to City Guide',
    description: `Add a place to a city guide. If the guide doesn't exist yet, use find_or_create_guide first.

Examples:
- "Add Télescope to my Paris guide under Coffee."
- "Add Bagnaia to my to-try list for Rome under Restaurants."
- "Note that Giacomo Arengario in Milan was recommended by Sarah."`,
    inputSchema: {
      guide_id: z.string().uuid().describe('The UUID of the city guide'),
      name: z.string().describe('Name of the place'),
      category: z
        .string()
        .optional()
        .default('Hidden Gems')
        .describe(
          'Category: Coffee, Restaurants, Hotels, Bars & Wine, Museums & Galleries, Shopping, Parks & Nature, Activities, Music & Nightlife, Running & Sports, Markets, Architecture, Hidden Gems'
        ),
      status: z
        .enum(['visited', 'to_try'])
        .optional()
        .default('visited')
        .describe('"visited" (you have been) or "to_try" (want to go)'),
      description: z
        .string()
        .optional()
        .describe('Your personal take — write a paragraph, not a star rating'),
      address: z.string().optional().describe('Street address'),
      website_url: z.string().optional().describe("Place's website URL"),
      rating: z
        .number()
        .int()
        .min(1)
        .max(5)
        .optional()
        .describe('Personal rating 1-5 (optional)'),
      recommended_by: z.string().optional().describe('Who recommended this place'),
      latitude: z.number().optional().describe('Latitude coordinate'),
      longitude: z.number().optional().describe('Longitude coordinate'),
      tags: z.array(z.string()).optional().describe('Freeform tags'),
    },
  },
  async (input) => {
    const body = { ...input, source: 'agent' }
    const result = await fetch(`${BASE_URL}/api/v1/guides/${input.guide_id}/entries`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    }).then((r) => r.json())

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.registerTool(
  'find_or_create_guide',
  {
    title: 'Find or Create City Guide',
    description:
      'Find an existing guide for a city, or create one if it doesn\'t exist. Use this before add_guide_entry when you\'re not sure if a guide exists.',
    inputSchema: {
      city: z.string().describe('City name (e.g. "Paris", "Milan", "Tokyo")'),
      country: z.string().optional().describe('Country name'),
      country_code: z.string().optional().describe('ISO 3166-1 alpha-2 country code (e.g. "FR")'),
    },
  },
  async ({ city, country, country_code }) => {
    const result = await fetch(`${BASE_URL}/api/v1/guides`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ city, country, country_code, find_or_create: true }),
    }).then((r) => r.json())

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.registerTool(
  'update_guide_entry',
  {
    title: 'Update Guide Entry',
    description: 'Update an existing entry in a city guide (e.g. mark as visited, add description, update rating).',
    inputSchema: {
      guide_id: z.string().uuid().describe('The UUID of the city guide'),
      entry_id: z.string().uuid().describe('The UUID of the entry to update'),
      name: z.string().optional(),
      category: z.string().optional(),
      status: z.enum(['visited', 'to_try']).optional(),
      description: z.string().optional(),
      address: z.string().optional(),
      website_url: z.string().optional(),
      rating: z.number().int().min(1).max(5).optional(),
      recommended_by: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      tags: z.array(z.string()).optional(),
    },
  },
  async ({ guide_id, entry_id, ...updates }) => {
    const result = await fetch(`${BASE_URL}/api/v1/guides/${guide_id}/entries/${entry_id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    }).then((r) => r.json())

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.registerTool(
  'get_nearby_places',
  {
    title: 'Get Nearby Places from Guides',
    description:
      'Find places from your city guides near a given location. Returns entries sorted by distance. Use for "what do I have recommended near me?" queries.',
    inputSchema: {
      lat: z.number().describe('Latitude'),
      lng: z.number().describe('Longitude'),
      radius_km: z
        .number()
        .optional()
        .default(5)
        .describe('Search radius in kilometers (default: 5)'),
    },
  },
  async ({ lat, lng, radius_km = 5 }) => {
    const result = await apiFetch<{ data: unknown[]; meta: { count: number } }>(
      `/api/v1/guides/nearby?lat=${lat}&lng=${lng}&radius=${radius_km}`
    )
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

// ---------------------------------------------------------------------------
// Parity Tools — PRD 011 (move_item, merge_trips, cover images, calendar, senders)
// ---------------------------------------------------------------------------

server.registerTool(
  'move_item',
  {
    title: 'Move Item to Another Trip',
    description: `Move a trip item from its current trip to a different trip. Both trips must belong to you.

Example: move_item({ item_id: "...", target_trip_id: "..." })`,
    inputSchema: {
      item_id: z.string().uuid().describe('UUID of the item to move'),
      target_trip_id: z.string().uuid().describe('UUID of the destination trip'),
    },
  },
  async ({ item_id, target_trip_id }) => {
    const res = await fetch(`${BASE_URL}/api/v1/items/${item_id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ trip_id: target_trip_id }),
    })
    const result = await res.json()
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.registerTool(
  'merge_trips',
  {
    title: 'Merge Trips',
    description: `Merge all items from a source trip into a target trip, then delete the source. Irreversible — confirm with user before calling.

Example: merge_trips({ target_trip_id: "...", source_trip_id: "..." })`,
    inputSchema: {
      target_trip_id: z.string().uuid().describe('UUID of the trip to merge items INTO (kept)'),
      source_trip_id: z.string().uuid().describe('UUID of the trip to merge FROM (deleted after)'),
    },
  },
  async ({ target_trip_id, source_trip_id }) => {
    const res = await fetch(`${BASE_URL}/api/v1/trips/${target_trip_id}/merge`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ source_trip_id }),
    })
    const result = await res.json()
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.registerTool(
  'search_cover_image',
  {
    title: 'Search Cover Images',
    description: `Search for cover images via Unsplash. Returns image URLs, thumbnails, and photographer credit. Pair with update_trip({ cover_image_url }) to set a cover.

Example: search_cover_image({ query: "tokyo night city" })`,
    inputSchema: {
      query: z.string().min(1).describe('Search query (e.g. "tokyo night", "paris eiffel", "alpine skiing")'),
      per_page: z.number().int().min(1).max(20).optional().describe('Number of results (default: 9)'),
    },
  },
  async ({ query, per_page = 9 }) => {
    const qs = new URLSearchParams({ q: query, per_page: String(per_page) })
    const result = await apiFetch<{ data: unknown[]; meta: unknown }>(`/api/v1/images/search?${qs}`)
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.registerTool(
  'get_calendar_url',
  {
    title: 'Get Calendar Feed URL',
    description: `Get your personal iCal calendar feed URL — a persistent, subscribable link you can add to any calendar app (Google Calendar, Apple Calendar, Fantastical) to see all upcoming trips auto-updated.`,
  },
  async () => {
    const result = await apiFetch<{ data: { token: string; feed_url: string } }>('/api/v1/calendar/token')
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.registerTool(
  'regenerate_calendar_token',
  {
    title: 'Regenerate Calendar Token',
    description: `Regenerate the calendar feed token. This invalidates the old URL and creates a new one. Use when the old URL has been shared accidentally.`,
  },
  async () => {
    const res = await fetch(`${BASE_URL}/api/v1/calendar/token`, {
      method: 'POST',
      headers: authHeaders(),
    })
    const result = await res.json()
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.registerTool(
  'list_senders',
  {
    title: 'List Allowed Email Senders',
    description: `List all email addresses allowed to forward confirmation emails to your UBTRIPPIN inbox. Only emails from these addresses will be automatically parsed and added to your trips.`,
  },
  async () => {
    const result = await apiFetch<{ data: unknown[]; meta: { count: number } }>('/api/v1/settings/senders')
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.registerTool(
  'add_sender',
  {
    title: 'Add Allowed Sender',
    description: `Add an email address to the allowed senders list. Emails forwarded from this address will be parsed and added to trips automatically.

Example: add_sender({ email: "me@gmail.com", label: "Personal" })`,
    inputSchema: {
      email: z.string().email().describe('Email address to allow'),
      label: z.string().optional().describe('Optional label (e.g. "Personal", "Work", "Claude")'),
    },
  },
  async ({ email, label }) => {
    const res = await fetch(`${BASE_URL}/api/v1/settings/senders`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ email, label }),
    })
    const result = await res.json()
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.registerTool(
  'delete_sender',
  {
    title: 'Remove Allowed Sender',
    description: `Remove an email address from the allowed senders list. Future emails from this address will no longer be processed.`,
    inputSchema: {
      sender_id: z.string().uuid().describe('UUID of the sender entry to remove (get IDs from list_senders)'),
    },
  },
  async ({ sender_id }) => {
    const res = await fetch(`${BASE_URL}/api/v1/settings/senders/${sender_id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (res.status === 204) {
      return { content: [{ type: 'text', text: JSON.stringify({ deleted: true, sender_id }) }] }
    }
    const result = await res.json()
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  }
)

// ---------------------------------------------------------------------------
// Collaboration Tools (PRD 009)
// ---------------------------------------------------------------------------

server.registerTool(
  'list_collaborators',
  {
    title: 'List Trip Collaborators',
    description: `List all collaborators on a trip you own. Returns each collaborator's email, role (editor/viewer), and whether they have accepted the invite.

Requires: owner of the trip.`,
    inputSchema: {
      trip_id: z.string().uuid().describe('UUID of the trip'),
    },
  },
  async ({ trip_id }) => {
    const result = await apiFetch<{ data: unknown[]; meta: { count: number } }>(
      `/api/v1/trips/${trip_id}/collaborators`
    )
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  }
)

server.registerTool(
  'invite_collaborator',
  {
    title: 'Invite a Collaborator',
    description: `Invite someone to collaborate on a trip you own. An invite email is sent to the recipient.

- role "editor": can add and edit trip items
- role "viewer": read-only access to the trip

If the recipient doesn't have a UBTRIPPIN account, they'll be invited to create one and the trip will be waiting for them.

Requires Pro tier to send invites.`,
    inputSchema: {
      trip_id: z.string().uuid().describe('UUID of the trip'),
      email: z.string().email().describe('Email address of the person to invite'),
      role: z.enum(['editor', 'viewer']).default('editor').describe('Access level — editor can add items, viewer is read-only'),
    },
  },
  async ({ trip_id, email, role }) => {
    const res = await fetch(`${BASE_URL}/api/v1/trips/${trip_id}/collaborators`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ email, role }),
    })
    const result = await res.json()
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  }
)

server.registerTool(
  'update_collaborator_role',
  {
    title: 'Update Collaborator Role',
    description: `Change a collaborator's role on a trip you own. Can promote viewer → editor or demote editor → viewer.

Requires: owner of the trip.`,
    inputSchema: {
      trip_id: z.string().uuid().describe('UUID of the trip'),
      collaborator_id: z.string().uuid().describe('UUID of the collaborator record (from list_collaborators)'),
      role: z.enum(['editor', 'viewer']).describe('New role for the collaborator'),
    },
  },
  async ({ trip_id, collaborator_id, role }) => {
    const res = await fetch(`${BASE_URL}/api/v1/trips/${trip_id}/collaborators/${collaborator_id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ role }),
    })
    const result = await res.json()
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  }
)

server.registerTool(
  'remove_collaborator',
  {
    title: 'Remove a Collaborator',
    description: `Remove a collaborator from a trip you own. The trip will disappear from their dashboard immediately.

Requires: owner of the trip.`,
    inputSchema: {
      trip_id: z.string().uuid().describe('UUID of the trip'),
      collaborator_id: z.string().uuid().describe('UUID of the collaborator record (from list_collaborators)'),
    },
  },
  async ({ trip_id, collaborator_id }) => {
    const res = await fetch(`${BASE_URL}/api/v1/trips/${trip_id}/collaborators/${collaborator_id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (res.status === 204) {
      return { content: [{ type: 'text', text: JSON.stringify({ deleted: true, collaborator_id }) }] }
    }
    const result = await res.json()
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  }
)

// ---------------------------------------------------------------------------
// Notification Tools (PRD 009)
// ---------------------------------------------------------------------------

server.registerTool(
  'get_notifications',
  {
    title: 'Get Notifications',
    description: `Fetch recent notifications for your account.

Notification types:
- invite_accepted  — a collaborator accepted your trip invite
- entry_added      — a collaborator added an item to your trip

Poll this periodically or after receiving an invite email to see in-app events.`,
    inputSchema: {
      unread_only: z.boolean().optional().default(false).describe('If true, only return unread notifications'),
      limit: z.number().int().min(1).max(100).optional().default(20).describe('Max notifications to return (default 20)'),
    },
  },
  async ({ unread_only, limit }) => {
    const params = new URLSearchParams()
    if (unread_only) params.set('unread', 'true')
    if (limit) params.set('limit', String(limit))
    const qs = params.toString() ? `?${params}` : ''
    const result = await apiFetch<{ data: unknown[]; meta: { count: number; unread_count: number } }>(
      `/api/v1/notifications${qs}`
    )
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  }
)

server.registerTool(
  'mark_notification_read',
  {
    title: 'Mark Notification Read',
    description: `Mark a single notification as read. Use the notification ID from get_notifications.`,
    inputSchema: {
      notification_id: z.string().uuid().describe('UUID of the notification to mark as read'),
    },
  },
  async ({ notification_id }) => {
    const res = await fetch(`${BASE_URL}/api/v1/notifications/${notification_id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({}),
    })
    const result = await res.json()
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
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

server.registerResource(
  'guides',
  'ubtrippin://guides',
  {
    title: 'All City Guides',
    description: 'All city guides for the authenticated UBTRIPPIN user.',
    mimeType: 'application/json',
  },
  async (_uri) => {
    const result = await apiFetch<{ data: CityGuide[]; meta: { count: number } }>('/api/v1/guides')
    return {
      contents: [
        {
          uri: 'ubtrippin://guides',
          mimeType: 'application/json',
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  }
)

server.registerResource(
  'guide-detail',
  new ResourceTemplate('ubtrippin://guides/{id}', { list: undefined }),
  {
    title: 'City Guide Detail',
    description: 'Full detail for a single city guide including all entries.',
    mimeType: 'application/json',
  },
  async (uri, variables) => {
    const id = variables['id'] as string
    if (!id) throw new Error('Guide ID is required')
    const result = await apiFetch<{ data: CityGuideWithEntries; meta: { entry_count: number } }>(
      `/api/v1/guides/${id}`
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
