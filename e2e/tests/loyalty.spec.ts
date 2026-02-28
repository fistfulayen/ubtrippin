import { expect, test } from '@playwright/test'

import { apiDelete, apiGet, apiPost } from '../helpers/api'
import { sessionCookieHeader } from '../helpers/session'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

test.describe('Loyalty', () => {
  test('loyalty page loads without error', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()

    const response = await page.goto('/loyalty')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: /Loyalty/i })).toBeVisible()

    const body = await page.content()
    expect(body).not.toContain('Application error')
    expect(response?.status()).not.toBe(500)
  })

  test('GET /api/v1/loyalty/providers returns provider list', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()

    const cookie = await sessionCookieHeader(page)
    const { status, body } = await apiGet('/api/v1/loyalty/providers', {
      auth: 'none',
      headers: { cookie },
    })

    expect(status).toBe(200)
    const payload = asRecord(body)
    expect(payload).toBeTruthy()
    expect(Array.isArray(payload?.data)).toBe(true)
  })

  test('POST/GET/DELETE loyalty program lifecycle', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()

    const cookie = await sessionCookieHeader(page)
    let programId = ''

    try {
      const createResponse = await apiPost(
        '/api/v1/me/loyalty',
        {
          traveler_name: 'E2E Traveler',
          provider_type: 'airline',
          provider_name: 'Delta SkyMiles',
          provider_key: 'delta',
          program_number: 'DL001234',
          preferred: false,
        },
        { auth: 'none', headers: { cookie } }
      )

      if (createResponse.status === 403) {
        const payload = asRecord(createResponse.body)
        const error = asRecord(payload?.error)
        if (error?.code === 'pro_required') {
          test.skip()
          return
        }
      }

      expect(createResponse.status).toBe(201)
      const createdPayload = asRecord(createResponse.body)
      const createdProgram = asRecord(createdPayload?.data)
      expect(createdProgram).toBeTruthy()

      const id = createdProgram?.id
      expect(typeof id).toBe('string')
      programId = id as string

      const listResponse = await apiGet('/api/v1/me/loyalty', {
        auth: 'none',
        headers: { cookie },
      })
      expect(listResponse.status).toBe(200)

      const listPayload = asRecord(listResponse.body)
      const list = (listPayload?.data ?? []) as Array<Record<string, unknown>>
      expect(Array.isArray(list)).toBe(true)

      const createdInList = list.find((item) => item.id === programId)
      expect(createdInList).toBeTruthy()

      const masked = createdInList?.program_number_masked
      expect(typeof masked).toBe('string')
      expect((masked as string).includes('•')).toBe(true)
      expect((masked as string)).toMatch(/•+1234$/)
    } finally {
      if (programId) {
        const deleted = await apiDelete(`/api/v1/me/loyalty/${programId}`, {
          auth: 'none',
          headers: { cookie },
        })
        expect([200, 204]).toContain(deleted.status)
      }
    }
  })
})
