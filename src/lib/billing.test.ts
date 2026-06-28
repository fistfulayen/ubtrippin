import { describe, expect, it } from 'vitest'

import {
  EARLY_ADOPTER_LIMIT,
  getEarlyAdopterSpotsRemaining,
  getProSubscriberCount,
  hasUnlimitedProAccess,
  mapStripeSubscriptionStatusToTier,
  unixSecondsToIso,
} from './billing'

describe('mapStripeSubscriptionStatusToTier', () => {
  it('maps active to pro', () => {
    expect(mapStripeSubscriptionStatusToTier('active')).toBe('pro')
  })

  it('maps trialing to pro', () => {
    expect(mapStripeSubscriptionStatusToTier('trialing')).toBe('pro')
  })

  it('maps paused to paused', () => {
    expect(mapStripeSubscriptionStatusToTier('paused')).toBe('paused')
  })

  it('maps past_due to grace', () => {
    expect(mapStripeSubscriptionStatusToTier('past_due')).toBe('grace')
  })

  it('maps unpaid to grace', () => {
    expect(mapStripeSubscriptionStatusToTier('unpaid')).toBe('grace')
  })

  it('defaults unknown status to free', () => {
    expect(mapStripeSubscriptionStatusToTier('incomplete')).toBe('free')
  })
})

describe('getEarlyAdopterSpotsRemaining', () => {
  it('returns remaining spots when under limit', () => {
    expect(getEarlyAdopterSpotsRemaining(25)).toBe(EARLY_ADOPTER_LIMIT - 25)
  })

  it('returns zero when over limit', () => {
    expect(getEarlyAdopterSpotsRemaining(EARLY_ADOPTER_LIMIT + 10)).toBe(0)
  })
})

describe('hasUnlimitedProAccess', () => {
  it('treats pro and grace tiers as unlimited', () => {
    expect(hasUnlimitedProAccess('pro')).toBe(true)
    expect(hasUnlimitedProAccess('grace')).toBe(true)
  })

  it('does not treat free, paused, or missing tiers as unlimited', () => {
    expect(hasUnlimitedProAccess('free')).toBe(false)
    expect(hasUnlimitedProAccess('paused')).toBe(false)
    expect(hasUnlimitedProAccess(null)).toBe(false)
    expect(hasUnlimitedProAccess(undefined)).toBe(false)
  })
})

describe('getProSubscriberCount', () => {
  it('parses numeric rpc result', async () => {
    const client = {
      rpc: async () => ({ data: 17, error: null }),
    }
    await expect(getProSubscriberCount(client)).resolves.toBe(17)
  })

  it('parses string rpc result', async () => {
    const client = {
      rpc: async () => ({ data: '42', error: null }),
    }
    await expect(getProSubscriberCount(client)).resolves.toBe(42)
  })

  it('clamps negative values to zero', async () => {
    const client = {
      rpc: async () => ({ data: -4, error: null }),
    }
    await expect(getProSubscriberCount(client)).resolves.toBe(0)
  })

  it('throws on rpc error', async () => {
    const client = {
      rpc: async () => ({ data: null, error: { message: 'boom' } }),
    }
    await expect(getProSubscriberCount(client)).rejects.toThrow('boom')
  })
})

describe('unixSecondsToIso', () => {
  it('converts unix seconds to ISO string', () => {
    expect(unixSecondsToIso(1_700_000_000)).toBe('2023-11-14T22:13:20.000Z')
  })

  it('returns null for nullish value', () => {
    expect(unixSecondsToIso(null)).toBeNull()
    expect(unixSecondsToIso(undefined)).toBeNull()
  })
})
