import { test, expect } from '@playwright/test'
import { apiDelete, apiGet, apiPost } from '../helpers/api'

function requireApiKey() {
  if (!process.env.TEST_API_KEY) test.skip()
}

test.describe('Webhooks API', () => {
  let webhookId = ''

  test.afterAll(async () => {
    if (!webhookId || !process.env.TEST_API_KEY) return
    await apiDelete(`/api/v1/webhooks/${webhookId}`)
  })

  test('POST /api/v1/webhooks registers a webhook', async () => {
    requireApiKey()

    const created = await apiPost('/api/v1/webhooks', {
      url: `https://webhook.site/${Date.now()}-ubtrippin-e2e`,
      secret: 'ubtrippin_e2e_secret_12345',
      description: 'E2E webhook',
      events: ['trip.created'],
    })

    test.skip(
      created.status === 403,
      'Webhook registration is pro-only for this test user'
    )

    expect(created.status).toBe(201)
    expect(created.body).toBeTruthy()

    const id = (created.body as { data?: { id?: string } }).data?.id
    expect(id).toBeTruthy()
    webhookId = id ?? ''
  })

  test('GET /api/v1/webhooks list includes webhook', async () => {
    requireApiKey()
    if (!webhookId) test.skip()

    const list = await apiGet('/api/v1/webhooks')
    expect(list.status).toBe(200)

    const rows = (list.body as { data?: Array<{ id: string }> }).data ?? []
    expect(rows.some((row) => row.id === webhookId)).toBe(true)
  })

  test('POST /api/v1/webhooks/:id/test queues a delivery', async () => {
    requireApiKey()
    if (!webhookId) test.skip()

    const triggered = await apiPost(`/api/v1/webhooks/${webhookId}/test`, {})
    expect(triggered.status).toBe(200)

    const queued = (triggered.body as { data?: { queued?: boolean } }).data?.queued
    expect(queued).toBe(true)
  })

  test('GET /api/v1/webhooks/:id/deliveries returns delivery log', async () => {
    requireApiKey()
    if (!webhookId) test.skip()

    let found = false

    for (let i = 0; i < 8; i += 1) {
      const deliveries = await apiGet(`/api/v1/webhooks/${webhookId}/deliveries`)
      expect(deliveries.status).toBe(200)

      const rows = (deliveries.body as { data?: Array<{ event?: string }> }).data ?? []
      if (rows.length > 0) {
        found = true
        expect(rows[0].event).toBeTruthy()
        break
      }

      await new Promise((resolve) => setTimeout(resolve, 750))
    }

    expect(found).toBe(true)
  })

  test('DELETE /api/v1/webhooks/:id removes webhook', async () => {
    requireApiKey()
    if (!webhookId) test.skip()

    const deleted = await apiDelete(`/api/v1/webhooks/${webhookId}`)
    expect([200, 204]).toContain(deleted.status)

    webhookId = ''
  })
})
