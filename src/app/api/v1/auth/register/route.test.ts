import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  from: vi.fn(), createUser: vi.fn(), deleteUser: vi.fn(), resend: vi.fn(),
  rateLimit: vi.fn(), writes: [] as { table: string; patch: Record<string, unknown>; filters: unknown[][] }[],
  inviteAvailable: true,
}))
vi.mock('@/lib/supabase/service', () => ({ createSecretClient: () => ({
  from: fixture.from, auth: { admin: { createUser: fixture.createUser, deleteUser: fixture.deleteUser },
    resend: fixture.resend },
}) }))
vi.mock('@/lib/api/durable-rate-limit', () => ({ consumePublicRateLimit: fixture.rateLimit }))
import { POST } from './route'

describe('invite admission and mailbox verification', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    fixture.writes.length = 0
    fixture.inviteAvailable = true
    fixture.rateLimit.mockResolvedValue(true)
    fixture.createUser.mockResolvedValue({ data: { user: { id: 'new-user', email_confirmed_at: null } }, error: null })
    fixture.deleteUser.mockResolvedValue({ error: null })
    fixture.resend.mockResolvedValue({ data: {}, error: null })
    fixture.from.mockImplementation((table: string) => {
      const filters: unknown[][] = []
      const builder: Record<string, unknown> = {
        update: (patch: Record<string, unknown>) => { fixture.writes.push({ table, patch, filters }); return builder },
        upsert: async () => ({ error: null }), select: () => builder,
        maybeSingle: async () => ({ data: fixture.inviteAvailable ? { id: 'invite-1', inviter_id: 'inviter-1' } : null, error: null }),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
      }
      for (const method of ['eq', 'is', 'gt']) builder[method] = (...values: unknown[]) => { filters.push([method, ...values]); return builder }
      return builder
    })
  })
  const request = () => new NextRequest('https://example.test/api/v1/auth/register', {
    method: 'POST', body: JSON.stringify({ email: 'unproved@example.test', password: 'dummy-password',
      full_name: 'Dummy User', invite_code: 'A'.repeat(32) }),
  })

  it('creates an unconfirmed account and asks the mailbox owner to verify', async () => {
    const response = await POST(request())
    expect(response.status).toBe(202)
    expect(fixture.createUser).toHaveBeenCalledWith(expect.objectContaining({ email_confirm: false }))
    expect(fixture.resend).toHaveBeenCalledWith({ type: 'signup', email: 'unproved@example.test' })
    const body = await response.json()
    expect(body.verification_required).toBe(true)
    expect(body).not.toHaveProperty('token')
    expect(fixture.deleteUser).not.toHaveBeenCalled()
  })

  it('does not create users for a used or unavailable invite', async () => {
    fixture.inviteAvailable = false
    expect((await POST(request())).status).toBe(400)
    expect(fixture.createUser).not.toHaveBeenCalled()
  })

  it('preserves existing accounts when registration is rejected', async () => {
    fixture.createUser.mockResolvedValue({ data: { user: null }, error: { code: 'user_already_exists' } })
    expect((await POST(request())).status).toBe(409)
    expect(fixture.deleteUser).not.toHaveBeenCalled()
    expect(fixture.resend).not.toHaveBeenCalled()
  })

  it('releases only its own finalized claim when sending verification fails', async () => {
    fixture.resend.mockResolvedValue({ error: { message: 'dummy unavailable' } })
    expect((await POST(request())).status).toBe(503)
    expect(fixture.deleteUser).toHaveBeenCalledWith('new-user')
    const release = fixture.writes.find(w => w.patch.invitee_id === null)
    expect(release?.filters).toContainEqual(['eq', 'id', 'invite-1'])
    expect(release?.filters).toContainEqual(['eq', 'invitee_id', 'new-user'])
  })
})
