import { expect, test } from '@playwright/test'

import { apiDelete, apiGet, apiPost } from '../helpers/api'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

test.describe('Webhooks API', () => {
  test('register, list, test, check deliveries, and delete webhook', async () => {
    if (!process.env.TEST_API_KEY) test.skip()

    let webhookId = ''

    try {
      const created = await apiPost('/api/v1/webhooks', {
        url: `https://example.com/ubtrippin-e2e-${Date.now()}`,
        description: 'E2E webhook',
        secret: 'ubtrippin-e2e-secret',
        events: ['trip.created'],
      })

      if (created.status === 403) {
        const payload = asRecord(created.body)
        const error = asRecord(payload?.error)
        if (error?.code === 'limit_exceeded') {
          test.skip()
          return
        }
      }

      expect(created.status).toBe(201)
      const createdPayload = asRecord(created.body)
      const createdWebhook = asRecord(createdPayload?.data)
      expect(typeof createdWebhook?.id).toBe('string')
      webhookId = createdWebhook?.id as string

      const listed = await apiGet('/api/v1/webhooks')
      expect(listed.status).toBe(200)
      const listPayload = asRecord(listed.body)
      const webhooks = (listPayload?.data ?? []) as Array<Record<string, unknown>>
      expect(Array.isArray(webhooks)).toBe(true)
      expect(webhooks.some((webhook) => webhook.id === webhookId)).toBe(true)

      const triggered = await apiPost(`/api/v1/webhooks/${webhookId}/test`, {})
      expect(triggered.status).toBe(200)
      const triggerPayload = asRecord(triggered.body)
      const triggerData = asRecord(triggerPayload?.data)
      expect(triggerData?.queued).toBe(true)

      await expect.poll(async () => {
        const deliveries = await apiGet(`/api/v1/webhooks/${webhookId}/deliveries`)
        if (deliveries.status !== 200) return 0

        const deliveryPayload = asRecord(deliveries.body)
        const list = (deliveryPayload?.data ?? []) as Array<Record<string, unknown>>
        return list.length
      }).toBeGreaterThan(0)

      const deleted = await apiDelete(`/api/v1/webhooks/${webhookId}`)
      expect([200, 204]).toContain(deleted.status)
      webhookId = ''
    } finally {
      if (webhookId) {
        await apiDelete(`/api/v1/webhooks/${webhookId}`)
      }
    }
  })
})
