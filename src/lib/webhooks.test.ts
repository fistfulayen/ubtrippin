import { describe, expect, it } from 'vitest'

import {
  buildWebhookDeliveryPayload,
  serializeWebhookPayload,
  signWebhookPayload,
} from './webhooks'

describe('buildWebhookDeliveryPayload', () => {
  it('always sets version to 1', () => {
    const payload = buildWebhookDeliveryPayload({
      event: 'trip.created',
      webhookId: 'wh_1',
      deliveryId: 'del_1',
      timestamp: '2026-02-28T00:00:00.000Z',
      data: { trip_id: 'trip_1' },
    })

    expect(payload.version).toBe('1')
  })

  it('copies event and identifiers into payload', () => {
    const payload = buildWebhookDeliveryPayload({
      event: 'item.updated',
      webhookId: 'wh_2',
      deliveryId: 'del_2',
      timestamp: '2026-02-28T00:00:00.000Z',
      data: { item_id: 'item_1' },
    })

    expect(payload).toMatchObject({
      event: 'item.updated',
      webhook_id: 'wh_2',
      delivery_id: 'del_2',
      timestamp: '2026-02-28T00:00:00.000Z',
      data: { item_id: 'item_1' },
    })
  })
})

describe('serializeWebhookPayload', () => {
  it('serializes payload as stable JSON format', () => {
    const payload = buildWebhookDeliveryPayload({
      event: 'trip.updated',
      webhookId: 'wh_3',
      deliveryId: 'del_3',
      timestamp: '2026-02-28T00:00:00.000Z',
      data: { a: 1, b: 'two' },
    })

    expect(serializeWebhookPayload(payload)).toBe(
      '{"version":"1","event":"trip.updated","webhook_id":"wh_3","delivery_id":"del_3","timestamp":"2026-02-28T00:00:00.000Z","data":{"a":1,"b":"two"}}'
    )
  })

  it('preserves nested objects', () => {
    const payload = buildWebhookDeliveryPayload({
      event: 'item.created',
      webhookId: 'wh_4',
      deliveryId: 'del_4',
      timestamp: '2026-02-28T00:00:00.000Z',
      data: { nested: { code: 'X1' } },
    })

    expect(serializeWebhookPayload(payload)).toContain('"nested":{"code":"X1"}')
  })
})

describe('signWebhookPayload', () => {
  it('is deterministic for same payload and secret', () => {
    const payload = '{"x":1}'
    const secret = 'test-secret'
    expect(signWebhookPayload(payload, secret)).toBe(signWebhookPayload(payload, secret))
  })

  it('changes when payload changes', () => {
    const secret = 'test-secret'
    expect(signWebhookPayload('{"x":1}', secret)).not.toBe(signWebhookPayload('{"x":2}', secret))
  })

  it('changes when secret changes', () => {
    const payload = '{"x":1}'
    expect(signWebhookPayload(payload, 'secret-a')).not.toBe(signWebhookPayload(payload, 'secret-b'))
  })

  it('produces expected HMAC SHA-256 hex digest', () => {
    const digest = signWebhookPayload('hello', 'secret')
    expect(digest).toBe('88aab3ede8d3adf94d26ab90d3bafd4a2083070c3bcce9c014ee04a443847c0b')
  })
})
