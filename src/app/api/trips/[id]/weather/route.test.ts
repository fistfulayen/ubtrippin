import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const fixture = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), write: vi.fn(), weather: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/api/session-auth', () => ({ requireSessionAuth: fixture.auth, isSessionAuthError: (result: unknown) => result instanceof Response }))
vi.mock('@/lib/trips/access', () => ({ resolveTripReadAccess: fixture.read, resolveTripWriteAccess: fixture.write }))
vi.mock('@/lib/weather/service', () => ({ getTripWeather: fixture.weather, canRefreshWeather: () => true }))
vi.mock('@/lib/api/rate-limit', () => ({ checkRateLimit: () => ({ allowed: true, remaining: 100 }) }))

import { GET, POST } from './route'

const tripId = '11111111-1111-4111-8111-111111111111'
const context = () => ({ params: Promise.resolve({ id: tripId }) })
const request = (query = '') => new NextRequest(`https://app.test/api/trips/${tripId}/weather${query}`)

describe('weather route authorization with API-key service-client fallback', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    fixture.auth.mockResolvedValue({ userId: 'viewer', supabase: { from: fixture.from } })
    fixture.read.mockResolvedValue({ allowed: true, role: 'owner' })
    fixture.write.mockResolvedValue({ allowed: true, role: 'owner' })
    fixture.weather.mockResolvedValue({ trip_id: tripId, trip_title: 'Authorized fixture' })
    fixture.from.mockImplementation((table: string) => {
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: table === 'trips' ? { user_id: 'owner' } : { subscription_tier: 'free' } }) }
      return query
    })
  })

  it.each([GET, POST])('denies an unrelated account before private plan/cache/weather queries', async (handler) => {
    fixture.read.mockResolvedValue({ allowed: false, reason: 'forbidden' })
    fixture.write.mockResolvedValue({ allowed: false, reason: 'forbidden' })
    const response = await handler(request(), context())
    expect(response.status).toBe(403)
    expect(fixture.weather).not.toHaveBeenCalled()
    expect(fixture.from).not.toHaveBeenCalled()
  })

  it('requires write access for forced refresh through GET', async () => {
    fixture.write.mockResolvedValue({ allowed: false, reason: 'viewer' })
    const response = await GET(request('?refresh=true'), context())
    expect(response.status).toBe(403)
    expect(fixture.read).not.toHaveBeenCalled()
    expect(fixture.weather).not.toHaveBeenCalled()
  })

  it('preserves ordinary weather reads for accepted viewers', async () => {
    fixture.read.mockResolvedValue({ allowed: true, role: 'viewer' })
    const response = await GET(request(), context())
    expect(response.status).toBe(200)
    expect(fixture.write).not.toHaveBeenCalled()
    expect(fixture.weather).toHaveBeenCalledWith(expect.objectContaining({ tripId, userId: 'viewer', forceRefresh: false }))
  })

  it('preserves refresh for authorized editors', async () => {
    fixture.write.mockResolvedValue({ allowed: true, role: 'editor' })
    expect((await POST(request(), context())).status).toBe(200)
    expect(fixture.weather).toHaveBeenCalledWith(expect.objectContaining({ forceRefresh: true }))
  })

  it('fails closed on permission-query errors', async () => {
    fixture.read.mockResolvedValue({ allowed: false, reason: 'internal_error' })
    expect((await GET(request(), context())).status).toBe(500)
    expect(fixture.weather).not.toHaveBeenCalled()
  })

  it('rejects invalid IDs before object lookup', async () => {
    expect((await GET(request(), { params: Promise.resolve({ id: 'invalid' }) })).status).toBe(400)
    expect(fixture.read).not.toHaveBeenCalled()
  })

  it('preserves unauthenticated rejection', async () => {
    fixture.auth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    expect((await GET(request(), context())).status).toBe(401)
    expect(fixture.read).not.toHaveBeenCalled()
  })
})
