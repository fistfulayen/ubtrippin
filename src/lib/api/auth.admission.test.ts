import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  key: vi.fn(), profile: vi.fn(), used: vi.fn(), from: vi.fn(),
}))
vi.mock('@/lib/supabase/service', () => ({ createSecretClient: () => ({ from: fixture.from }) }))
import { validateApiKey } from './auth'

beforeEach(() => {
  vi.clearAllMocks()
  fixture.key.mockResolvedValue({ data: { id: 'key-1', user_id: 'user-1' }, error: null })
  fixture.profile.mockResolvedValue({ data: { admitted_at: '2026-10-30T00:00:00Z' }, error: null })
  fixture.used.mockResolvedValue({ error: null })
  fixture.from.mockImplementation((table: string) => {
    if (table === 'api_keys') return {
      select: () => ({ eq: () => ({ single: fixture.key }) }),
      update: () => ({ eq: fixture.used }),
    }
    if (table === 'profiles') return { select: () => ({ eq: () => ({ maybeSingle: fixture.profile }) }) }
    throw new Error('Unexpected table')
  })
})
const request = () => new NextRequest('https://app.test/api/trips', {
  headers: { authorization: 'Bearer dummy-key' },
})
describe('API key admission', () => {
  it.each([
    { data: { admitted_at: null }, error: null },
    { data: null, error: null },
    { data: { admitted_at: '2026-10-30T00:00:00Z' }, error: { message: 'lookup failed' } },
  ])('denies a key when admission is absent or cannot be checked', async result => {
    fixture.profile.mockResolvedValue(result)
    const response = await validateApiKey(request())
    expect(response).toBeInstanceOf(NextResponse)
    expect((response as NextResponse).status).toBe(403)
    expect(fixture.used).not.toHaveBeenCalled()
  })
  it('accepts the admitted owner and preserves last-used tracking', async () => {
    const result = await validateApiKey(request())
    expect(result).toMatchObject({ userId: 'user-1' })
    expect(fixture.used).toHaveBeenCalled()
  })
  it('rejects invalid keys before any profile lookup', async () => {
    fixture.key.mockResolvedValue({ data: null, error: null })
    const response = await validateApiKey(request())
    expect((response as NextResponse).status).toBe(401)
    expect(fixture.profile).not.toHaveBeenCalled()
  })
})
