import { resolveTripWriteAccess } from './access'

interface QueryResult {
  data: unknown
  error: unknown
}

interface MockSupabase {
  from: ReturnType<typeof vi.fn>
}

function createSupabaseMock(results: QueryResult[]): MockSupabase {
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
    then,
  })

  return { from }
}

describe('resolveTripWriteAccess', () => {
  it('allows trip owner', async () => {
    const supabase = createSupabaseMock([
      { data: { id: 'trip-1', user_id: 'owner-1' }, error: null },
    ])

    const result = await resolveTripWriteAccess({
      supabase: supabase as unknown as Parameters<typeof resolveTripWriteAccess>[0]['supabase'],
      tripId: 'trip-1',
      userId: 'owner-1',
    })

    expect(result).toEqual({
      allowed: true,
      role: 'owner',
      trip: { id: 'trip-1', user_id: 'owner-1' },
    })
  })

  it('allows editor collaborator', async () => {
    const supabase = createSupabaseMock([
      { data: { id: 'trip-1', user_id: 'owner-1' }, error: null },
      { data: { role: 'editor' }, error: null },
    ])

    const result = await resolveTripWriteAccess({
      supabase: supabase as unknown as Parameters<typeof resolveTripWriteAccess>[0]['supabase'],
      tripId: 'trip-1',
      userId: 'editor-1',
    })

    expect(result).toEqual({
      allowed: true,
      role: 'editor',
      trip: { id: 'trip-1', user_id: 'owner-1' },
    })
  })

  it('denies viewer collaborator with viewer reason', async () => {
    const supabase = createSupabaseMock([
      { data: { id: 'trip-1', user_id: 'owner-1' }, error: null },
      { data: { role: 'viewer' }, error: null },
      { data: [], error: null },
    ])

    const result = await resolveTripWriteAccess({
      supabase: supabase as unknown as Parameters<typeof resolveTripWriteAccess>[0]['supabase'],
      tripId: 'trip-1',
      userId: 'viewer-1',
    })

    expect(result).toEqual({
      allowed: false,
      reason: 'viewer',
      trip: { id: 'trip-1', user_id: 'owner-1' },
    })
  })

  it('returns not_found when trip does not exist', async () => {
    const supabase = createSupabaseMock([{ data: null, error: null }])

    const result = await resolveTripWriteAccess({
      supabase: supabase as unknown as Parameters<typeof resolveTripWriteAccess>[0]['supabase'],
      tripId: 'missing-trip',
      userId: 'user-1',
    })

    expect(result).toEqual({ allowed: false, reason: 'not_found' })
  })

  it('denies non-participant as forbidden when trip exists', async () => {
    const supabase = createSupabaseMock([
      { data: { id: 'trip-1', user_id: 'owner-1' }, error: null },
      { data: null, error: null },
      { data: [], error: null },
    ])

    const result = await resolveTripWriteAccess({
      supabase: supabase as unknown as Parameters<typeof resolveTripWriteAccess>[0]['supabase'],
      tripId: 'trip-1',
      userId: 'stranger-1',
    })

    expect(result).toEqual({
      allowed: false,
      reason: 'forbidden',
      trip: { id: 'trip-1', user_id: 'owner-1' },
    })
  })

  it('allows family member when sharing accepted family_id with owner', async () => {
    const supabase = createSupabaseMock([
      { data: { id: 'trip-1', user_id: 'owner-1' }, error: null },
      { data: null, error: null },
      { data: [{ family_id: 'family-1' }], error: null },
      { data: { id: 'fm-owner' }, error: null },
    ])

    const result = await resolveTripWriteAccess({
      supabase: supabase as unknown as Parameters<typeof resolveTripWriteAccess>[0]['supabase'],
      tripId: 'trip-1',
      userId: 'family-user',
    })

    expect(result).toEqual({
      allowed: true,
      role: 'family_member',
      trip: { id: 'trip-1', user_id: 'owner-1' },
    })
  })

  it('returns internal_error if trip lookup errors', async () => {
    const supabase = createSupabaseMock([
      { data: null, error: { message: 'db down' } },
    ])

    const result = await resolveTripWriteAccess({
      supabase: supabase as unknown as Parameters<typeof resolveTripWriteAccess>[0]['supabase'],
      tripId: 'trip-1',
      userId: 'user-1',
    })

    expect(result).toEqual({ allowed: false, reason: 'internal_error' })
  })

  it('returns internal_error if collaborator lookup errors', async () => {
    const supabase = createSupabaseMock([
      { data: { id: 'trip-1', user_id: 'owner-1' }, error: null },
      { data: null, error: { message: 'db down' } },
    ])

    const result = await resolveTripWriteAccess({
      supabase: supabase as unknown as Parameters<typeof resolveTripWriteAccess>[0]['supabase'],
      tripId: 'trip-1',
      userId: 'user-2',
    })

    expect(result).toEqual({ allowed: false, reason: 'internal_error' })
  })
})
