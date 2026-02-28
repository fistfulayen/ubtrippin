import type { SupabaseClient } from '@supabase/supabase-js'

import {
  checkExtractionLimit,
  checkTripLimit,
  getUserTier,
  incrementExtractionCount,
} from './limits'

interface QueryResult {
  data: unknown
  error: unknown
}

interface MockSupabaseControls {
  mock: SupabaseClient
  from: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  not: ReturnType<typeof vi.fn>
  inOp: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
}

function createSupabaseMock(results: QueryResult[]): MockSupabaseControls {
  const queue = [...results]
  const next = (): QueryResult => queue.shift() ?? { data: null, error: null }

  const builder: Record<string, unknown> = {}

  const from = vi.fn(() => builder)
  const select = vi.fn(() => builder)
  const eq = vi.fn(() => builder)
  const not = vi.fn(() => builder)
  const inOp = vi.fn(() => builder)
  const limit = vi.fn(() => builder)
  const maybeSingle = vi.fn(async () => next())
  const single = vi.fn(async () => next())
  const update = vi.fn(() => builder)
  const insert = vi.fn(async () => ({ data: null, error: null }))

  const then: PromiseLike<QueryResult>['then'] = (onFulfilled, onRejected) =>
    Promise.resolve(next()).then(onFulfilled, onRejected)

  Object.assign(builder, {
    from,
    select,
    eq,
    not,
    in: inOp,
    limit,
    maybeSingle,
    single,
    update,
    insert,
    then,
  })

  return {
    mock: builder as unknown as SupabaseClient,
    from,
    select,
    eq,
    maybeSingle,
    single,
    update,
    insert,
    not,
    inOp,
    limit,
  }
}

describe('usage limits', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-28T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('getUserTier returns free when profile has no tier', async () => {
    const supabase = createSupabaseMock([{ data: { subscription_tier: null }, error: null }])

    await expect(getUserTier('user-1', supabase.mock)).resolves.toBe('free')
  })

  it('checkTripLimit returns allowed=true when user is under free trip limit', async () => {
    const supabase = createSupabaseMock([
      { data: { subscription_tier: 'free' }, error: null },
      {
        data: [
          { id: '1', start_date: '2026-03-10', end_date: '2026-03-12' },
          { id: '2', start_date: null, end_date: null },
          { id: '3', start_date: '2025-01-01', end_date: '2025-01-02' },
        ],
        error: null,
      },
    ])

    await expect(checkTripLimit('user-1', supabase.mock)).resolves.toEqual({
      allowed: true,
      used: 2,
      limit: 3,
    })
  })

  it('checkTripLimit returns allowed=false exactly at free trip limit', async () => {
    const supabase = createSupabaseMock([
      { data: { subscription_tier: 'free' }, error: null },
      {
        data: [
          { id: '1', start_date: '2026-03-01', end_date: '2026-03-10' },
          { id: '2', start_date: '2026-04-01', end_date: null },
          { id: '3', start_date: null, end_date: null },
        ],
        error: null,
      },
    ])

    await expect(checkTripLimit('user-1', supabase.mock)).resolves.toEqual({
      allowed: false,
      used: 3,
      limit: 3,
    })
  })

  it('checkTripLimit returns unlimited access for pro tier', async () => {
    const supabase = createSupabaseMock([{ data: { subscription_tier: 'pro' }, error: null }])

    await expect(checkTripLimit('user-1', supabase.mock)).resolves.toEqual({
      allowed: true,
      used: 0,
      limit: null,
    })
  })

  it('checkExtractionLimit returns allowed=true when under free extraction limit', async () => {
    const supabase = createSupabaseMock([
      { data: { subscription_tier: 'free' }, error: null },
      { data: { count: 9 }, error: null },
    ])

    await expect(checkExtractionLimit('user-1', supabase.mock)).resolves.toEqual({
      allowed: true,
      used: 9,
      limit: 10,
    })
  })

  it('checkExtractionLimit returns allowed=false exactly at free extraction limit boundary', async () => {
    const supabase = createSupabaseMock([
      { data: { subscription_tier: 'free' }, error: null },
      { data: { count: 10 }, error: null },
    ])

    await expect(checkExtractionLimit('user-1', supabase.mock)).resolves.toEqual({
      allowed: false,
      used: 10,
      limit: 10,
    })
  })

  it('checkExtractionLimit defaults used=0 when no monthly row exists', async () => {
    const supabase = createSupabaseMock([
      { data: { subscription_tier: 'free' }, error: null },
      { data: null, error: null },
    ])

    await expect(checkExtractionLimit('user-1', supabase.mock)).resolves.toEqual({
      allowed: true,
      used: 0,
      limit: 10,
    })
  })

  it('incrementExtractionCount updates existing month counter', async () => {
    const supabase = createSupabaseMock([{ data: { count: 4 }, error: null }])

    await incrementExtractionCount('user-1', supabase.mock)

    expect(supabase.update).toHaveBeenCalledWith({ count: 5 })
    expect(supabase.insert).not.toHaveBeenCalled()
  })

  it('incrementExtractionCount inserts row when month counter does not exist', async () => {
    const supabase = createSupabaseMock([{ data: null, error: null }])

    await incrementExtractionCount('user-1', supabase.mock)

    expect(supabase.insert).toHaveBeenCalledTimes(1)
    expect(supabase.update).not.toHaveBeenCalled()
  })
})
