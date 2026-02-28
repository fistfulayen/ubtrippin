import { test, expect } from '@playwright/test'
import { requestJson } from '../helpers/request'

function requireSession() {
  if (!process.env.TEST_USER_EMAIL) test.skip()
}

test.describe('Loyalty', () => {
  let createdId = ''

  test.afterAll(async ({ request }) => {
    if (!createdId) return
    await requestJson(request, 'DELETE', `/api/v1/me/loyalty/${createdId}`)
  })

  test('loads /loyalty without error', async ({ page }) => {
    requireSession()
    const response = await page.goto('/loyalty')
    await expect(page).not.toHaveURL(/\/login/)
    expect(response?.status()).not.toBe(500)
    await expect(page.getByRole('heading', { name: 'Loyalty Programs' })).toBeVisible()
  })

  test('GET /api/v1/loyalty/providers returns provider list', async ({ request }) => {
    const providers = await requestJson(request, 'GET', '/api/v1/loyalty/providers')
    expect(providers.status).toBe(200)
    const data = (providers.body as { data?: unknown[] }).data
    expect(Array.isArray(data)).toBe(true)
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  test('POST /api/v1/me/loyalty creates program', async ({ request }) => {
    requireSession()
    const created = await requestJson(request, 'POST', '/api/v1/me/loyalty', {
      traveler_name: 'E2E Traveler',
      provider_type: 'airline',
      provider_name: 'Delta SkyMiles',
      provider_key: 'delta',
      program_number: '1234561234',
      preferred: false,
    })
    expect(created.status).toBe(201)
    const data = (created.body as { data?: { id?: string } }).data
    expect(data?.id).toBeTruthy()
    createdId = data?.id ?? ''
  })

  test('GET /api/v1/me/loyalty lists created program', async ({ request }) => {
    requireSession()
    if (!createdId) test.skip()
    const list = await requestJson(request, 'GET', '/api/v1/me/loyalty')
    expect(list.status).toBe(200)
    const data = (list.body as { data?: Array<{ id: string }> }).data ?? []
    expect(data.find((e) => e.id === createdId)).toBeDefined()
  })

  test('DELETE /api/v1/me/loyalty/:id removes program', async ({ request }) => {
    requireSession()
    if (!createdId) test.skip()
    const deleted = await requestJson(request, 'DELETE', `/api/v1/me/loyalty/${createdId}`)
    expect([200, 204]).toContain(deleted.status)
    createdId = ''
  })
})
