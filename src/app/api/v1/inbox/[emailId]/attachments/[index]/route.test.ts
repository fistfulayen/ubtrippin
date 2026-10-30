import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const fixture = vi.hoisted(() => ({ user: 'owner-a' as string | null, path: 'owner-a/email/ticket.pdf', emailOwner: 'owner-a', sign: vi.fn(), service: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createSecretClient: fixture.service }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: fixture.user ? { id: fixture.user } : null } }) },
  from: () => {
    const filters = new Map<string, unknown>()
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.set(key, value); return query },
      single: async () => ({ data: filters.get('user_id') === fixture.emailOwner ? { attachments_json: [{ storage_path: fixture.path, filename: 'ticket.pdf', content_type: 'application/pdf' }] } : null }),
    }
    return query
  },
  storage: { from: () => ({ createSignedUrl: fixture.sign }) },
}) }))

import { GET } from './route'

const emailId = '11111111-1111-4111-8111-111111111111'
const request = () => new NextRequest(`https://app.test/api/v1/inbox/${emailId}/attachments/0`)
const context = (index = '0') => ({ params: Promise.resolve({ emailId, index }) })

describe('inbox attachment storage authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fixture.user = 'owner-a'
    fixture.path = 'owner-a/email/ticket.pdf'
    fixture.emailOwner = 'owner-a'
    fixture.sign.mockResolvedValue({ data: { signedUrl: 'https://storage.test/owned-ticket' }, error: null })
  })

  it('signs an owned path through the session storage client', async () => {
    expect((await GET(request(), context())).status).toBe(200)
    expect(fixture.sign).toHaveBeenCalledWith('owner-a/email/ticket.pdf', 3600)
    expect(fixture.service).not.toHaveBeenCalled()
  })

  it.each(['owner-b/email/ticket.pdf', '/owner-a/email/ticket.pdf', 'owner-a/../owner-b/ticket.pdf'])('rejects a foreign or noncanonical locator: %s', async (path) => {
    fixture.path = path
    expect((await GET(request(), context())).status).toBe(403)
    expect(fixture.sign).not.toHaveBeenCalled()
    expect(fixture.service).not.toHaveBeenCalled()
  })

  it('does not fetch another user email even with a known email ID', async () => {
    fixture.emailOwner = 'owner-b'
    expect((await GET(request(), context())).status).toBe(404)
    expect(fixture.sign).not.toHaveBeenCalled()
  })

  it.each(['-1', '0junk', '1.2', '9007199254740992'])('rejects a malformed attachment index: %s', async (index) => {
    expect((await GET(request(), context(index))).status).toBe(400)
    expect(fixture.sign).not.toHaveBeenCalled()
  })

  it('requires a signed-in owner', async () => {
    fixture.user = null
    expect((await GET(request(), context())).status).toBe(401)
    expect(fixture.sign).not.toHaveBeenCalled()
  })
})
