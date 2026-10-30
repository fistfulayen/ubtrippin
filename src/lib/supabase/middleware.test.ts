import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ claims: vi.fn(), profile: vi.fn(), from: vi.fn() }))
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getClaims: fixture.claims }, from: fixture.from }),
}))
import { updateSession } from './middleware'
beforeEach(() => {
  vi.clearAllMocks()
  fixture.claims.mockResolvedValue({ data: { claims: { sub: 'user-1' } } })
  fixture.profile.mockResolvedValue({ data: { admitted_at: null }, error: null })
  fixture.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: fixture.profile }) }) })
})
describe('session admission on API requests', () => {
  it.each(['/api/keys', '/api/trips/search', '/api/v1/me'])('rejects an unadmitted session at %s', async path => {
    expect((await updateSession(new NextRequest('https://app.test'+path))).status).toBe(403)
  })
  it('preserves admitted sessions', async () => {
    fixture.profile.mockResolvedValue({ data: { admitted_at: '2026-10-30T00:00:00Z' } })
    expect((await updateSession(new NextRequest('https://app.test/api/keys'))).status).toBe(200)
  })
  it('leaves API-key-only requests to route authentication', async () => {
    fixture.claims.mockResolvedValue({ data: { claims: null } })
    expect((await updateSession(new NextRequest('https://app.test/api/keys'))).status).toBe(200)
    expect(fixture.profile).not.toHaveBeenCalled()
  })
  it.each(['/api/v1/auth/register', '/api/v1/auth/login', '/api/auth/logout'])('keeps authentication reachable at %s', async path => {
    expect((await updateSession(new NextRequest('https://app.test'+path))).status).toBe(200)
    expect(fixture.profile).not.toHaveBeenCalled()
  })
  it('permits owner key revocation after admission is removed', async () => {
    expect((await updateSession(new NextRequest('https://app.test/api/keys', { method: 'DELETE' }))).status).toBe(200)
    expect(fixture.profile).not.toHaveBeenCalled()
  })
  it('retains the protected-page login redirect', async () => {
    const response = await updateSession(new NextRequest('https://app.test/trips'))
    expect(response.status).toBe(307)
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login')
  })
})
