import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), getUser: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/api/auth', () => ({ validateApiKey: mocks.auth, isAuthError: () => false }))
vi.mock('@/lib/supabase/service', () => ({
  createSecretClient: () => ({ auth: { admin: { getUserById: mocks.getUser } }, from: mocks.from }),
}))
import { GET } from './route'

describe('token usage administrator identity', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('ADMIN_EMAILS', 'admin@example.test')
    mocks.auth.mockResolvedValue({ userId: 'ordinary-user' })
    mocks.from.mockImplementation(() => { throw new Error('Private query before authorization') })
  })

  it('denies a normal key even when its mutable profile/billing email could match an admin', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: {
      id: 'ordinary-user', email: 'ordinary@example.test', email_confirmed_at: '2026-01-01',
    } }, error: null })
    const response = await GET(new NextRequest('https://example.test/api/v1/admin/token-usage'))
    expect(response.status).toBe(403)
    expect(mocks.getUser).toHaveBeenCalledWith('ordinary-user')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('denies an unconfirmed allowlisted mailbox', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: {
      id: 'ordinary-user', email: 'admin@example.test', email_confirmed_at: null,
    } }, error: null })
    expect((await GET(new NextRequest('https://example.test'))).status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('fails closed if Auth cannot resolve the key owner', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'unavailable' } })
    expect((await GET(new NextRequest('https://example.test'))).status).toBe(403)
  })

  it('preserves access for the verified allowlisted Auth principal', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: {
      id: 'ordinary-user', email: ' ADMIN@example.test ', email_confirmed_at: '2026-01-01',
    } }, error: null })
    mocks.from.mockImplementation((table: string) => {
      expect(table).toBe('token_usage')
      const builder: Record<string, unknown> = {}
      for (const method of ['select', 'gte', 'lt', 'order', 'limit']) builder[method] = () => builder
      builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve)
      return builder
    })
    const response = await GET(new NextRequest('https://example.test'))
    expect(response.status).toBe(200)
    expect((await response.json()).top_expensive).toEqual([])
  })
})
