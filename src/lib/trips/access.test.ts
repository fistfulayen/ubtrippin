import { describe, expect, it } from 'vitest'

import { resolveTripWriteAccess } from './access'

type QueryResponse = { data: unknown; error: { message: string } | null }

function makeTripsQuery(response: QueryResponse) {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => response,
  }
  return query
}

function makeCollabQuery(response: QueryResponse) {
  const query = {
    select: () => query,
    eq: () => query,
    not: () => query,
    maybeSingle: async () => response,
  }
  return query
}

function makeFamilyListQuery(response: QueryResponse) {
  const query = {
    select: () => query,
    eq: () => query,
    not: async () => response,
  }
  return query
}

function makeOwnerFamilyQuery(response: QueryResponse) {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    not: () => query,
    limit: () => query,
    maybeSingle: async () => response,
  }
  return query
}

function makeSupabaseWithQuerySequence(queries: unknown) {
  const queue = [...(queries as unknown[])]
  return {
    from: () => {
      const next = queue.shift()
      if (!next) throw new Error('No query object left in test queue')
      return next
    },
  }
}

describe('resolveTripWriteAccess', () => {
  it('allows trip owner', async () => {
    const supabase = makeSupabaseWithQuerySequence([
      makeTripsQuery({ data: { id: 'trip-1', user_id: 'user-1' }, error: null }),
    ])

    const result = await resolveTripWriteAccess({
      supabase: supabase as never,
      tripId: 'trip-1',
      userId: 'user-1',
    })

    expect(result).toEqual({
      allowed: true,
      role: 'owner',
      trip: { id: 'trip-1', user_id: 'user-1' },
    })
  })

  it('allows accepted editor collaborator', async () => {
    const supabase = makeSupabaseWithQuerySequence([
      makeTripsQuery({ data: { id: 'trip-1', user_id: 'owner-1' }, error: null }),
      makeCollabQuery({ data: { role: 'editor' }, error: null }),
    ])

    const result = await resolveTripWriteAccess({
      supabase: supabase as never,
      tripId: 'trip-1',
      userId: 'editor-1',
    })

    expect(result).toMatchObject({ allowed: true, role: 'editor' })
  })

  it('denies viewer collaborator with viewer reason', async () => {
    const supabase = makeSupabaseWithQuerySequence([
      makeTripsQuery({ data: { id: 'trip-1', user_id: 'owner-1' }, error: null }),
      makeCollabQuery({ data: { role: 'viewer' }, error: null }),
      makeFamilyListQuery({ data: [], error: null }),
    ])

    const result = await resolveTripWriteAccess({
      supabase: supabase as never,
      tripId: 'trip-1',
      userId: 'viewer-1',
    })

    expect(result).toMatchObject({ allowed: false, reason: 'viewer' })
  })

  it('returns not_found when trip does not exist', async () => {
    const supabase = makeSupabaseWithQuerySequence([
      makeTripsQuery({ data: null, error: null }),
    ])

    const result = await resolveTripWriteAccess({
      supabase: supabase as never,
      tripId: 'missing',
      userId: 'user-1',
    })

    expect(result).toEqual({ allowed: false, reason: 'not_found' })
  })

  it('allows accepted family member when owner is in same family', async () => {
    const supabase = makeSupabaseWithQuerySequence([
      makeTripsQuery({ data: { id: 'trip-1', user_id: 'owner-1' }, error: null }),
      makeCollabQuery({ data: null, error: null }),
      makeFamilyListQuery({ data: [{ family_id: 'fam-1' }], error: null }),
      makeOwnerFamilyQuery({ data: { id: 'member-1' }, error: null }),
    ])

    const result = await resolveTripWriteAccess({
      supabase: supabase as never,
      tripId: 'trip-1',
      userId: 'family-user-1',
    })

    expect(result).toMatchObject({ allowed: true, role: 'family_member' })
  })

  it('denies non-participant with forbidden reason', async () => {
    const supabase = makeSupabaseWithQuerySequence([
      makeTripsQuery({ data: { id: 'trip-1', user_id: 'owner-1' }, error: null }),
      makeCollabQuery({ data: null, error: null }),
      makeFamilyListQuery({ data: [], error: null }),
    ])

    const result = await resolveTripWriteAccess({
      supabase: supabase as never,
      tripId: 'trip-1',
      userId: 'outsider-1',
    })

    expect(result).toMatchObject({ allowed: false, reason: 'forbidden' })
  })

  it('returns internal_error when trip lookup fails', async () => {
    const supabase = makeSupabaseWithQuerySequence([
      makeTripsQuery({ data: null, error: { message: 'db failure' } }),
    ])

    const result = await resolveTripWriteAccess({
      supabase: supabase as never,
      tripId: 'trip-1',
      userId: 'user-1',
    })

    expect(result).toEqual({ allowed: false, reason: 'internal_error' })
  })

  it('returns internal_error when collaborator lookup fails', async () => {
    const supabase = makeSupabaseWithQuerySequence([
      makeTripsQuery({ data: { id: 'trip-1', user_id: 'owner-1' }, error: null }),
      makeCollabQuery({ data: null, error: { message: 'db failure' } }),
    ])

    const result = await resolveTripWriteAccess({
      supabase: supabase as never,
      tripId: 'trip-1',
      userId: 'user-1',
    })

    expect(result).toEqual({ allowed: false, reason: 'internal_error' })
  })

  it('returns internal_error when family membership lookup fails', async () => {
    const supabase = makeSupabaseWithQuerySequence([
      makeTripsQuery({ data: { id: 'trip-1', user_id: 'owner-1' }, error: null }),
      makeCollabQuery({ data: null, error: null }),
      makeFamilyListQuery({ data: null, error: { message: 'db failure' } }),
    ])

    const result = await resolveTripWriteAccess({
      supabase: supabase as never,
      tripId: 'trip-1',
      userId: 'user-1',
    })

    expect(result).toEqual({ allowed: false, reason: 'internal_error' })
  })
})
