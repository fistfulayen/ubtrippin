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
      const json = JSON.parse(body)
      errMsg = json?.error?.message || errMsg
    } catch {}
    throw new Error(errMsg)
  }

  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer(
  { name: 'ubtrippin', version: '1.0.0' },
  {
    capabilities: { resources: {}, tools: {} },
    instructions: `
This server provides read-only access to your UBTRIPPIN travel data.
Requires UBT_API_KEY environment variable (from ubtrippin.xyz/settings).

Available tools: list_trips, get_trip, get_item
Available resources: ubtrippin://trips, ubtrippin://trips/{id}
    `.trim(),
  }
)

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

server.registerTool(
  'list_trips',
  {
    title: 'List Trips',
    description:
      'List all trips for the authenticated user, ordered by start date (soonest upcoming / most recent first).',
  },
  async () => {
    const result = await apiFetch<{ data: unknown[]; meta: { count: number } }>('/api/v1/trips')
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
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
    const result = await apiFetch<{ data: unknown; meta: { item_count: number } }>(
      `/api/v1/trips/${trip_id}`
    )
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  }
)

server.registerTool(
  'get_item',
  {
    title: 'Get Item',
    description:
      'Get a single trip item (flight, hotel, train, etc.) by item ID.',
    inputSchema: {
      item_id: z.string().uuid().describe('The UUID of the item to retrieve'),
    },
  },
  async ({ item_id }) => {
    const result = await apiFetch<{ data: unknown }>(`/api/v1/items/${item_id}`)
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
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
    const result = await apiFetch<{ data: unknown[]; meta: { count: number } }>('/api/v1/trips')
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
    if (!id) {
      throw new Error('Trip ID is required')
    }
    const result = await apiFetch<{ data: unknown; meta: { item_count: number } }>(
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
