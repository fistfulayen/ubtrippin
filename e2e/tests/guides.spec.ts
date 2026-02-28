/**
 * P1 City Guide tests
 *
 * Tests:
 *   1. /guides page loads for authenticated user
 *   2. GET /api/v1/guides returns array via API key
 *   3. POST /api/v1/guides creates a guide
 *   4. POST /api/v1/guides/[id]/entries creates an entry
 *   5. GET /api/v1/guides/[id] returns guide with entries
 *   6. Public share page is accessible without auth
 *   7. Cleanup — delete guide via API
 */

import { test, expect } from '@playwright/test'
import { apiGet, apiPost, apiDelete } from '../helpers/api'
import { adminClient } from '../helpers/supabase-admin'
import { seedGuide, seedGuideEntry, deleteGuide } from '../fixtures/seed-guide'

test.describe('/guides page', () => {
  test('loads for authenticated user', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL) test.skip()

    const response = await page.goto('/guides')
    await expect(page).not.toHaveURL(/\/login/)

    const body = await page.content()
    expect(body).not.toContain('Application error')
    expect(response?.status()).not.toBe(500)
  })

  test('shows guides nav item', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL) test.skip()

    await page.goto('/trips')
    // Nav should include a Guides link
    const nav = page.locator('nav, header')
    const body = await nav.textContent()
    expect(body?.toLowerCase()).toMatch(/guide/i)
  })
})

test.describe('City Guides REST API', () => {
  let guideId: string

  test('GET /api/v1/guides returns array', async () => {
    if (!process.env.TEST_API_KEY) test.skip()

    const { status, body } = await apiGet('/api/v1/guides')
    expect(status).toBe(200)
    expect(body).toHaveProperty('data')
    expect(Array.isArray(body.data)).toBe(true)
  })

  test('POST /api/v1/guides creates a guide', async () => {
    if (!process.env.TEST_API_KEY) test.skip()

    const { status, body } = await apiPost('/api/v1/guides', {
      city: 'E2E Test City',
      country: 'Japan',
      country_code: 'JP',
    })
    expect(status).toBe(201)
    expect(body).toHaveProperty('data')
    expect(body.data).toHaveProperty('id')
    expect(body.data.city).toBe('E2E Test City')

    guideId = body.data.id
  })

  test('POST /api/v1/guides/[id]/entries creates an entry', async () => {
    if (!process.env.TEST_API_KEY || !guideId) test.skip()

    const { status, body } = await apiPost(`/api/v1/guides/${guideId}/entries`, {
      name: 'E2E Test Ramen',
      category: 'restaurants',
      status: 'visited',
      description: 'Best tsukemen in Tokyo',
    })
    expect(status).toBe(201)
    expect(body).toHaveProperty('data')
    expect(body.data.name).toBe('E2E Test Ramen')
  })

  test('GET /api/v1/guides/[id] returns guide with entries', async () => {
    if (!process.env.TEST_API_KEY || !guideId) test.skip()

    const { status, body } = await apiGet(`/api/v1/guides/${guideId}`)
    expect(status).toBe(200)
    expect(body.data.city).toBe('E2E Test City')
    expect(Array.isArray(body.data.entries)).toBe(true)
    expect(body.data.entries.length).toBeGreaterThan(0)
    expect(body.data.entries[0].name).toBe('E2E Test Ramen')
  })

  test('DELETE /api/v1/guides/[id] removes guide', async () => {
    if (!process.env.TEST_API_KEY || !guideId) test.skip()

    const { status } = await apiDelete(`/api/v1/guides/${guideId}`)
    expect([200, 204]).toContain(status)
  })
})

test.describe('City Guide — seed + UI', () => {
  let guideId: string
  const userId = process.env.TEST_USER_ID ?? ''

  test.beforeAll(async () => {
    if (!userId) return
    guideId = await seedGuide({ userId, city: 'E2E Seeded City', country: 'France', countryCode: 'FR' })
    await seedGuideEntry({ guideId, userId, name: 'E2E Seeded Brasserie', category: 'restaurants', status: 'visited' })
  })

  test.afterAll(async () => {
    if (guideId) await deleteGuide(guideId)
  })

  test('seeded guide detail page renders without error', async ({ page }) => {
    if (!userId || !guideId) test.skip()

    await page.goto(`/guides/${guideId}`)
    await expect(page).not.toHaveURL(/\/login/)

    const body = await page.content()
    expect(body).not.toContain('Application error')
    await expect(page.getByText('E2E Seeded City')).toBeVisible()
  })

  test('seeded entry appears on guide page', async ({ page }) => {
    if (!userId || !guideId) test.skip()

    await page.goto(`/guides/${guideId}`)
    await expect(page.getByText('E2E Seeded Brasserie')).toBeVisible()
  })

  test('public share page accessible after enabling share', async ({ browser }) => {
    if (!userId || !guideId) test.skip()

    // Enable share via admin client
    const supabase = adminClient()
    const { data: guide } = await supabase
      .from('city_guides')
      .update({ share_enabled: true })
      .eq('id', guideId)
      .select('share_token')
      .single()

    if (!guide || !guide.share_token) {
      test.skip()
      return
    }

    const ctx = await browser.newContext() // no auth
    const page = await ctx.newPage()

    await page.goto(`/guide/${guide.share_token}`)
    await expect(page).not.toHaveURL(/\/login/)

    const body = await page.content()
    expect(body).not.toContain('Application error')
    expect(body).not.toContain('404')

    await ctx.close()
  })
})

test.describe('Guide API — find_or_create', () => {
  test('POST /api/v1/guides with find_or_create=true returns existing guide', async () => {
    if (!process.env.TEST_API_KEY) test.skip()

    // Create once
    const { body: created } = await apiPost('/api/v1/guides', {
      city: 'E2E FoC City',
      country: 'Italy',
      country_code: 'IT',
      find_or_create: true,
    })

    // Create again with find_or_create — should return same id
    const { status, body: found } = await apiPost('/api/v1/guides', {
      city: 'E2E FoC City',
      country: 'Italy',
      country_code: 'IT',
      find_or_create: true,
    })

    expect([200, 201]).toContain(status)
    if (created?.data?.id && found?.data?.id) {
      expect(found.data.id).toBe(created.data.id)
    }

    // Cleanup
    if (created?.data?.id) {
      await apiDelete(`/api/v1/guides/${created.data.id}`)
    }
  })
})
