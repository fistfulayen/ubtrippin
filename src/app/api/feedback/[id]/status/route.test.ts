import { NextRequest } from 'next/server'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const getUserMock = vi.fn()
const feedbackSelectMaybeSingleMock = vi.fn()
const feedbackSelectEqMock = vi.fn()
const feedbackSelectMock = vi.fn()
const feedbackUpdateMock = vi.fn()
const feedbackUpdateEqCalls: string[] = []
const feedbackUpdateEqMock = vi.fn()
const feedbackUpdateSelectMock = vi.fn()
const feedbackUpdateSingleMock = vi.fn()
const storageRemoveMock = vi.fn()
const storageFromMock = vi.fn()
const fromMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: getUserMock,
    },
    from: fromMock,
    storage: {
      from: storageFromMock,
    },
  })),
}))

import { PATCH } from './route'

function buildFeedbackTableMock() {
  const selectQuery = {
    eq: feedbackSelectEqMock,
    maybeSingle: feedbackSelectMaybeSingleMock,
  }

  feedbackSelectMock.mockReturnValue(selectQuery)
  feedbackSelectEqMock.mockReturnValue(selectQuery)

  const updateSelectQuery = {
    single: feedbackUpdateSingleMock,
  }

  const updateQuery = {
    eq: feedbackUpdateEqMock,
    select: feedbackUpdateSelectMock,
  }

  feedbackUpdateMock.mockReturnValue(updateQuery)
  feedbackUpdateEqMock.mockImplementation((field: string) => {
    feedbackUpdateEqCalls.push(field)
    return updateQuery
  })
  feedbackUpdateSelectMock.mockReturnValue(updateSelectQuery)

  return {
    select: feedbackSelectMock,
    update: feedbackUpdateMock,
  }
}

describe('PATCH /api/feedback/[id]/status', () => {
  const originalFeedbackAdmins = process.env.FEEDBACK_ADMIN_EMAILS

  beforeEach(() => {
    vi.clearAllMocks()
    feedbackUpdateEqCalls.length = 0
    process.env.FEEDBACK_ADMIN_EMAILS = 'admin@example.com'

    const feedbackTable = buildFeedbackTableMock()
    fromMock.mockImplementation((table: string) => {
      if (table === 'feedback') return feedbackTable
      throw new Error(`Unexpected table: ${table}`)
    })

    storageFromMock.mockReturnValue({
      remove: storageRemoveMock,
    })
  })

  afterAll(() => {
    if (originalFeedbackAdmins === undefined) {
      delete process.env.FEEDBACK_ADMIN_EMAILS
    } else {
      process.env.FEEDBACK_ADMIN_EMAILS = originalFeedbackAdmins
    }
  })

  it('returns 403 for authenticated non-admin users', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'traveler@example.com' } },
    })

    const request = new NextRequest('https://example.com/api/feedback/11111111-1111-4111-8111-111111111111/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'shipped' }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }),
    })

    expect(response.status).toBe(403)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('allows configured admins to update status without author scoping', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'admin-1', email: 'admin@example.com' } },
    })
    feedbackSelectMaybeSingleMock.mockResolvedValue({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        user_id: 'author-1',
        status: 'new',
        image_url: null,
      },
    })
    feedbackUpdateSingleMock.mockResolvedValue({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        user_id: 'author-1',
        type: 'feature',
        title: 'Feedback title',
        body: 'Feedback body',
        image_url: null,
        status: 'planned',
        votes: 3,
        created_at: '2026-03-10T00:00:00.000Z',
        updated_at: '2026-03-10T00:00:00.000Z',
      },
      error: null,
    })

    const request = new NextRequest('https://example.com/api/feedback/11111111-1111-4111-8111-111111111111/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'planned' }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }),
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.status).toBe('planned')
    expect(feedbackUpdateEqCalls).toEqual(['id'])
    expect(feedbackUpdateEqCalls).not.toContain('user_id')
  })
})
