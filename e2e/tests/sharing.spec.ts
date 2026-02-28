import { randomUUID } from 'node:crypto'
import { test, expect } from '@playwright/test'
import { apiDelete, apiPost } from '../helpers/api'
import { adminClient } from '../helpers/supabase-admin'

function hasApiKey() {
  return Boolean(process.env.TEST_API_KEY)
}

function hasAdminEnv() {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY
  )
}

test.describe('Trip sharing', () => {
  let tripId = ''
  let shareToken = ''

  test.beforeAll(async () => {
    if (!hasApiKey() || !hasAdminEnv()) return

    const created = await apiPost('/api/v1/trips', {
      title: 'E2E Sharing Trip',
      start_date: '2027-01-11',
      end_date: '2027-01-14',
      primary_location: 'Seattle, USA',
    })

    if (created.status !== 201 || !created.body || typeof created.body !== 'object') return

    const id = (created.body as { data?: { id?: string } }).data?.id
    if (!id) return

    tripId = id
    shareToken = `e2e_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 10)}`

    const supabase = adminClient()
    await supabase
      .from('trips')
      .update({ share_enabled: true, share_token: shareToken })
      .eq('id', tripId)
  })

  test.afterAll(async () => {
    if (!tripId || !hasApiKey()) return
    await apiDelete(`/api/v1/trips/${tripId}`)
  })

  test('API creates trip and sharing is enabled', async () => {
    if (!hasApiKey() || !hasAdminEnv() || !tripId || !shareToken) test.skip()

    const supabase = adminClient()
    const { data } = await supabase
      .from('trips')
      .select('id, share_enabled, share_token')
      .eq('id', tripId)
      .single()

    expect(data?.id).toBe(tripId)
    expect(data?.share_enabled).toBe(true)
    expect(data?.share_token).toBe(shareToken)
  })

  test('public share URL loads without auth and shows trip info', async ({ browser }) => {
    if (!tripId || !shareToken) test.skip()

    const ctx = await browser.newContext()
    const page = await ctx.newPage()

    await page.goto(`/share/${shareToken}`)
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText('E2E Sharing Trip')).toBeVisible()

    const body = await page.content()
    expect(body).not.toContain('Application error')

    await ctx.close()
  })

  test('share page is read-only (no edit controls)', async ({ browser }) => {
    if (!shareToken) test.skip()

    const ctx = await browser.newContext()
    const page = await ctx.newPage()

    await page.goto(`/share/${shareToken}`)

    const body = await page.textContent('body')
    expect(body).not.toMatch(/add item|edit trip|delete trip|sharing enabled/i)

    await ctx.close()
  })
})
