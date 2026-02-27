import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

type ApiFetch = <T>(path: string) => Promise<T>

type ToolResult = {
  content: Array<{
    type: 'text'
    text: string
  }>
}

function toToolResult(payload: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  }
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

async function runJsonTool<T>(fn: () => Promise<T>, fallbackMessage: string): Promise<ToolResult> {
  try {
    return toToolResult(await fn())
  } catch (error) {
    return toToolResult({
      error: {
        code: 'tool_error',
        message: toErrorMessage(error, fallbackMessage),
      },
    })
  }
}

export function registerFamilyTools(server: McpServer, apiFetch: ApiFetch): void {
  server.registerTool(
    'list_families',
    {
      title: 'List Families',
      description: 'List all families the authenticated user belongs to.',
    },
    async () =>
      runJsonTool(
        () => apiFetch<{ data: unknown[] }>('/api/v1/families'),
        'Failed to list families.'
      )
  )

  server.registerTool(
    'get_family',
    {
      title: 'Get Family',
      description: 'Get a family by ID, including member list and viewer role.',
      inputSchema: {
        family_id: z.string().uuid().describe('UUID of the family'),
      },
    },
    async ({ family_id }) =>
      runJsonTool(
        () => apiFetch<{ data: unknown }>(`/api/v1/families/${family_id}`),
        'Failed to get family.'
      )
  )

  server.registerTool(
    'get_family_loyalty',
    {
      title: 'Get Family Loyalty Programs',
      description: 'List loyalty programs across all accepted members of a family.',
      inputSchema: {
        family_id: z.string().uuid().describe('UUID of the family'),
      },
    },
    async ({ family_id }) =>
      runJsonTool(
        () => apiFetch<{ data: unknown[]; meta?: unknown }>(`/api/v1/families/${family_id}/loyalty`),
        'Failed to get family loyalty programs.'
      )
  )

  server.registerTool(
    'lookup_family_loyalty',
    {
      title: 'Lookup Family Loyalty Program',
      description:
        'Lookup loyalty programs for each family member by provider, with alliance fallback when available.',
      inputSchema: {
        family_id: z.string().uuid().describe('UUID of the family'),
        provider: z.string().min(1).describe('Provider key or provider name to look up'),
      },
    },
    async ({ family_id, provider }) =>
      runJsonTool(
        () => {
          const qs = new URLSearchParams({ provider })
          return apiFetch<{ data: unknown[]; meta?: unknown }>(
            `/api/v1/families/${family_id}/loyalty/lookup?${qs}`
          )
        },
        'Failed to look up family loyalty program.'
      )
  )

  server.registerTool(
    'get_family_profiles',
    {
      title: 'Get Family Profiles',
      description: 'List traveler profiles/preferences for each accepted family member.',
      inputSchema: {
        family_id: z.string().uuid().describe('UUID of the family'),
      },
    },
    async ({ family_id }) =>
      runJsonTool(
        () => apiFetch<{ data: unknown[]; meta?: unknown }>(`/api/v1/families/${family_id}/profiles`),
        'Failed to get family profiles.'
      )
  )

  server.registerTool(
    'get_family_trips',
    {
      title: 'Get Family Trips',
      description:
        'List trips across all accepted family members. Optionally filter by scope (all/current/upcoming/past).',
      inputSchema: {
        family_id: z.string().uuid().describe('UUID of the family'),
        scope: z
          .enum(['all', 'current', 'upcoming', 'past'])
          .optional()
          .describe('Trip scope filter (default: all)'),
      },
    },
    async ({ family_id, scope }) =>
      runJsonTool(
        () => {
          const qs = scope ? `?scope=${scope}` : ''
          return apiFetch<{ data: unknown[]; meta?: unknown }>(
            `/api/v1/families/${family_id}/trips${qs}`
          )
        },
        'Failed to get family trips.'
      )
  )

  server.registerTool(
    'get_family_guides',
    {
      title: 'Get Family Guides',
      description: 'List city guides across all accepted family members, including guide entries.',
      inputSchema: {
        family_id: z.string().uuid().describe('UUID of the family'),
      },
    },
    async ({ family_id }) =>
      runJsonTool(
        () => apiFetch<{ data: unknown[]; meta?: unknown }>(`/api/v1/families/${family_id}/guides`),
        'Failed to get family guides.'
      )
  )
}
