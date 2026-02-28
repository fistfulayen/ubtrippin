import { expect, test } from '@playwright/test'

import { apiDelete, apiPost } from '../helpers/api'
import { sessionCookieHeader } from '../helpers/session'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

test.describe('Sharing', () => {
  test('create trip via API, enable sharing, and view share page unauthenticated', async ({
    page,
    browser,
  }) => {
    if (!process.env.TEST_API_KEY || !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
      test.skip()
    }

    let tripId = ''

    try {
      const title = `E2E Shared Trip ${Date.now()}`
      const created = await apiPost('/api/v1/trips', {
        title,
        start_date: '2027-06-01',
        end_date: '2027-06-05',
        primary_location: 'Tokyo, Japan',
      })

      expect(created.status).toBe(201)
      const createdPayload = asRecord(created.body)
      const createdTrip = asRecord(createdPayload?.data)
      expect(typeof createdTrip?.id).toBe('string')
      tripId = createdTrip?.id as string

      const cookie = await sessionCookieHeader(page)
      const shared = await apiPost(
        `/api/trips/${tripId}/share`,
        {},
        { auth: 'none', headers: { cookie } }
      )
      expect(shared.status).toBe(200)

      const sharePayload = asRecord(shared.body)
      const token = typeof sharePayload?.share_token === 'string'
        ? sharePayload.share_token
        : null
      expect(token).toBeTruthy()

      const publicContext = await browser.newContext()
      const publicPage = await publicContext.newPage()

      await publicPage.goto(`/share/${token}`)
      await expect(publicPage).not.toHaveURL(/\/login/)
      await expect(publicPage.getByText(title)).toBeVisible()

      const body = await publicPage.content()
      expect(body).not.toContain('Application error')
      expect(body).not.toContain('Back to trips')

      await expect(publicPage.getByText(/Add item/i)).toHaveCount(0)
      await expect(publicPage.getByText(/Sign out/i)).toHaveCount(0)

      await publicContext.close()
    } finally {
      if (tripId) {
        const deleted = await apiDelete(`/api/v1/trips/${tripId}`)
        expect([200, 204]).toContain(deleted.status)
      }
    }
  })
})
