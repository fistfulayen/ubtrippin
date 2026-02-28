import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { checkExtractionLimit, checkTripLimit, getUserTier } from './limits'

type QueryResult = { data: unknown; error: null }

interface LimitsMockConfig {
  subscriptionTier: 'free' | 'pro' | null
  extractionCount: number | null
  trips: Array<{ id: string; start_date: string | null; end_date: string | null }>
}

function createLimitsMockClient(config: LimitsMockConfig): SupabaseClient {
  const profilesQuery = {
    select: () => profilesQuery,
    eq: () => profilesQuery,
    single: async (): Promise<QueryResult> => ({
      data: { subscription_tier: config.subscriptionTier },
      error: null,
    }),
  }

  const monthlyQuery = {
    select: () => monthlyQuery,
    eq: () => monthlyQuery,
    maybeSingle: async (): Promise<QueryResult> => ({
      data: config.extractionCount === null ? null : { count: config.extractionCount },
      error: null,
    }),
  }

  const tripsQuery = {
    select: () => tripsQuery,
    eq: async (): Promise<QueryResult> => ({
      data: config.trips,
      error: null,
    }),
  }

  const mockClient = {
    from: (table: string) => {
      if (table === 'profiles') return profilesQuery
      if (table === 'monthly_extractions') return monthlyQuery
      if (table === 'trips') return tripsQuery
      throw new Error(`Unexpected table ${table}`)
    },
  }

  return mockClient as unknown as SupabaseClient
}

describe('getUserTier', () => {
  it('returns free tier when profile tier is null', async () => {
    const supabase = createLimitsMockClient({
      subscriptionTier: null,
      extractionCount: null,
      trips: [],
    })

    await expect(getUserTier('user-1', supabase)).resolves.toBe('free')
  })

  it('returns pro when profile has pro tier', async () => {
    const supabase = createLimitsMockClient({
      subscriptionTier: 'pro',
      extractionCount: null,
      trips: [],
    })

    await expect(getUserTier('user-1', supabase)).resolves.toBe('pro')
  })
})

describe('checkExtractionLimit', () => {
  it('returns allowed true when under free limit', async () => {
    const supabase = createLimitsMockClient({
      subscriptionTier: 'free',
      extractionCount: 9,
      trips: [],
    })

    await expect(checkExtractionLimit('user-1', supabase)).resolves.toEqual({
      allowed: true,
      used: 9,
      limit: 10,
    })
  })

  it('returns allowed false exactly at free limit boundary', async () => {
    const supabase = createLimitsMockClient({
      subscriptionTier: 'free',
      extractionCount: 10,
      trips: [],
    })

    await expect(checkExtractionLimit('user-1', supabase)).resolves.toEqual({
      allowed: false,
      used: 10,
      limit: 10,
    })
  })

  it('defaults used to 0 when row does not exist', async () => {
    const supabase = createLimitsMockClient({
      subscriptionTier: 'free',
      extractionCount: null,
      trips: [],
    })

    await expect(checkExtractionLimit('user-1', supabase)).resolves.toEqual({
      allowed: true,
      used: 0,
      limit: 10,
    })
  })

  it('returns unlimited for pro users', async () => {
    const supabase = createLimitsMockClient({
      subscriptionTier: 'pro',
      extractionCount: 999,
      trips: [],
    })

    await expect(checkExtractionLimit('user-1', supabase)).resolves.toEqual({
      allowed: true,
      used: 0,
      limit: null,
    })
  })
})

describe('checkTripLimit', () => {
  it('returns allowed true when under trip limit', async () => {
    const supabase = createLimitsMockClient({
      subscriptionTier: 'free',
      extractionCount: null,
      trips: [
        { id: 't1', start_date: '2099-01-01', end_date: null },
        { id: 't2', start_date: '2099-02-01', end_date: '2099-02-05' },
      ],
    })

    await expect(checkTripLimit('user-1', supabase)).resolves.toEqual({
      allowed: true,
      used: 2,
      limit: 3,
    })
  })

  it('returns allowed false exactly at trip limit boundary', async () => {
    const supabase = createLimitsMockClient({
      subscriptionTier: 'free',
      extractionCount: null,
      trips: [
        { id: 't1', start_date: '2099-01-01', end_date: null },
        { id: 't2', start_date: '2099-02-01', end_date: null },
        { id: 't3', start_date: '2099-03-01', end_date: null },
      ],
    })

    await expect(checkTripLimit('user-1', supabase)).resolves.toEqual({
      allowed: false,
      used: 3,
      limit: 3,
    })
  })

  it('excludes fully past trips from usage count', async () => {
    const supabase = createLimitsMockClient({
      subscriptionTier: 'free',
      extractionCount: null,
      trips: [{ id: 'past', start_date: '2000-01-01', end_date: '2000-01-02' }],
    })

    await expect(checkTripLimit('user-1', supabase)).resolves.toEqual({
      allowed: true,
      used: 0,
      limit: 3,
    })
  })

  it('counts trips with null start_date as active', async () => {
    const supabase = createLimitsMockClient({
      subscriptionTier: 'free',
      extractionCount: null,
      trips: [{ id: 'draft', start_date: null, end_date: null }],
    })

    await expect(checkTripLimit('user-1', supabase)).resolves.toEqual({
      allowed: true,
      used: 1,
      limit: 3,
    })
  })

  it('returns unlimited for pro users', async () => {
    const supabase = createLimitsMockClient({
      subscriptionTier: 'pro',
      extractionCount: null,
      trips: [
        { id: 'a', start_date: '2099-01-01', end_date: null },
        { id: 'b', start_date: '2099-02-01', end_date: null },
        { id: 'c', start_date: '2099-03-01', end_date: null },
        { id: 'd', start_date: '2099-04-01', end_date: null },
      ],
    })

    await expect(checkTripLimit('user-1', supabase)).resolves.toEqual({
      allowed: true,
      used: 0,
      limit: null,
    })
  })
})
