import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

type ApiFetch = <T>(path: string, init?: RequestInit) => Promise<T>

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

export function registerAffiliateTools(server: McpServer, apiFetch: ApiFetch): void {
  server.registerTool(
    'get_affiliate_dashboard',
    {
      title: 'Get Affiliate Dashboard',
      description:
        'Returns the authenticated user\'s affiliate dashboard: affiliate code, tier, status, earnings, payout info, and up to 50 recent conversions. Returns 404 if the user has not yet applied.',
    },
    async () =>
      runJsonTool(
        () => apiFetch<{ data: unknown }>('/api/v1/affiliate'),
        'Failed to fetch affiliate dashboard.'
      )
  )

  server.registerTool(
    'apply_for_affiliate',
    {
      title: 'Apply for Affiliate Program',
      description:
        'Submit an affiliate program application. Creates a pending affiliate record with a unique referral code. Returns 409 if an application already exists.',
      inputSchema: {
        payout_email: z
          .string()
          .email()
          .optional()
          .describe('Email address for payout notifications (optional)'),
        payout_method: z
          .enum(['stripe_connect', 'paypal'])
          .optional()
          .describe('Payout method: stripe_connect (default) or paypal'),
      },
    },
    async ({ payout_email, payout_method }) =>
      runJsonTool(
        () =>
          apiFetch<{ data: unknown }>('/api/v1/affiliate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...(payout_email !== undefined && { payout_email }),
              ...(payout_method !== undefined && { payout_method }),
            }),
          }),
        'Failed to submit affiliate application.'
      )
  )
}
