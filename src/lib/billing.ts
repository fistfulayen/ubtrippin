export const EARLY_ADOPTER_LIMIT = 100

export type BillingSubscriptionTier = 'free' | 'pro' | 'grace' | 'paused'

type RpcResult = {
  data: unknown
  error: { message?: string } | null
}

type RpcClient = {
  rpc: (fn: string, params?: Record<string, unknown>) => PromiseLike<RpcResult>
}

function parseCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 0
}

export async function getProSubscriberCount(client: RpcClient): Promise<number> {
  const { data, error } = await client.rpc('billing_pro_subscriber_count')

  if (error) {
    throw new Error(error.message ?? 'Failed to fetch subscriber count.')
  }

  return Math.max(0, parseCount(data))
}

export function getEarlyAdopterSpotsRemaining(count: number): number {
  return Math.max(0, EARLY_ADOPTER_LIMIT - count)
}

export function mapStripeSubscriptionStatusToTier(status: string | null | undefined): BillingSubscriptionTier {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'pro'
    case 'paused':
      return 'paused'
    case 'past_due':
    case 'unpaid':
      return 'grace'
    default:
      return 'free'
  }
}

export function unixSecondsToIso(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return new Date(value * 1000).toISOString()
}
