import {
  EARLY_ADOPTER_LIMIT,
  getEarlyAdopterSpotsRemaining,
  getProSubscriberCount,
  mapStripeSubscriptionStatusToTier,
  unixSecondsToIso,
} from './billing'

interface RpcResult {
  data: unknown
  error: { message?: string } | null
}

interface RpcClient {
  rpc: (fn: string, params?: Record<string, unknown>) => PromiseLike<RpcResult>
}

describe('billing tier mapping', () => {
  it('maps active status to pro', () => {
    expect(mapStripeSubscriptionStatusToTier('active')).toBe('pro')
  })

  it('maps trialing status to pro', () => {
    expect(mapStripeSubscriptionStatusToTier('trialing')).toBe('pro')
  })

  it('maps paused status to paused tier', () => {
    expect(mapStripeSubscriptionStatusToTier('paused')).toBe('paused')
  })

  it('maps past_due status to grace tier', () => {
    expect(mapStripeSubscriptionStatusToTier('past_due')).toBe('grace')
  })

  it('maps unpaid status to grace tier', () => {
    expect(mapStripeSubscriptionStatusToTier('unpaid')).toBe('grace')
  })

  it('maps unknown status to free tier', () => {
    expect(mapStripeSubscriptionStatusToTier('something_else')).toBe('free')
  })

  it('maps null/undefined status to free tier', () => {
    expect(mapStripeSubscriptionStatusToTier(null)).toBe('free')
    expect(mapStripeSubscriptionStatusToTier(undefined)).toBe('free')
  })
})

describe('early adopter accounting', () => {
  it('returns remaining early-adopter spots under the limit', () => {
    expect(getEarlyAdopterSpotsRemaining(25)).toBe(EARLY_ADOPTER_LIMIT - 25)
  })

  it('returns zero when count is over the limit', () => {
    expect(getEarlyAdopterSpotsRemaining(EARLY_ADOPTER_LIMIT + 10)).toBe(0)
  })
})

describe('getProSubscriberCount', () => {
  it('returns numeric rpc count values', async () => {
    const client: RpcClient = {
      rpc: async () => ({ data: 42, error: null }),
    }

    await expect(getProSubscriberCount(client)).resolves.toBe(42)
  })

  it('parses string rpc count values', async () => {
    const client: RpcClient = {
      rpc: async () => ({ data: '17', error: null }),
    }

    await expect(getProSubscriberCount(client)).resolves.toBe(17)
  })

  it('clamps invalid rpc values to zero', async () => {
    const client: RpcClient = {
      rpc: async () => ({ data: 'not-a-number', error: null }),
    }

    await expect(getProSubscriberCount(client)).resolves.toBe(0)
  })

  it('throws when rpc returns an error', async () => {
    const client: RpcClient = {
      rpc: async () => ({ data: null, error: { message: 'rpc failed' } }),
    }

    await expect(getProSubscriberCount(client)).rejects.toThrow('rpc failed')
  })
})

describe('unixSecondsToIso', () => {
  it('converts epoch seconds to ISO string', () => {
    expect(unixSecondsToIso(1_700_000_000)).toBe('2023-11-14T22:13:20.000Z')
  })

  it('returns null for invalid values', () => {
    expect(unixSecondsToIso(null)).toBeNull()
    expect(unixSecondsToIso(undefined)).toBeNull()
    expect(unixSecondsToIso(Number.NaN)).toBeNull()
  })
})
