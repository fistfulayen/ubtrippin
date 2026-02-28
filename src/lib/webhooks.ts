import crypto from 'crypto'

import { createSecretClient } from '@/lib/supabase/service'

export const WEBHOOK_EVENTS = [
  'trip.created',
  'trip.updated',
  'trip.deleted',
  'item.created',
  'item.updated',
  'item.deleted',
  'item.status_changed',
  'items.batch_created',
  'collaborator.invited',
  'collaborator.accepted',
  'collaborator.removed',
] as const

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number] | 'ping'

const DELIVERY_ATTEMPT_ONE = 1

export interface DispatchWebhookEventParams {
  userId: string
  tripId?: string
  event: WebhookEvent
  data: Record<string, unknown>
}

export interface DispatchWebhookEventResult {
  webhookCount: number
  deliveryCount: number
}

interface WebhookRow {
  id: string
  user_id: string
  events: string[] | null
}

function isSubscribed(events: string[] | null, event: string): boolean {
  if (!events || events.length === 0) return true
  return events.includes(event)
}

export interface WebhookDeliveryPayload {
  version: '1'
  event: WebhookEvent
  webhook_id: string
  delivery_id: string
  timestamp: string
  data: Record<string, unknown>
}

export function buildWebhookDeliveryPayload(args: {
  event: WebhookEvent
  webhookId: string
  deliveryId: string
  timestamp: string
  data: Record<string, unknown>
}): WebhookDeliveryPayload {
  return {
    version: '1',
    event: args.event,
    webhook_id: args.webhookId,
    delivery_id: args.deliveryId,
    timestamp: args.timestamp,
    data: args.data,
  }
}

export function serializeWebhookPayload(payload: WebhookDeliveryPayload): string {
  return JSON.stringify(payload)
}

export function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function removeSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => removeSensitiveFields(entry))
  }

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      const normalized = key.toLowerCase()
      if (
        normalized.includes('secret') ||
        normalized.includes('api_key') ||
        normalized.includes('key_hash') ||
        normalized.includes('password') ||
        normalized.includes('token') ||
        normalized.includes('loyalty_number') ||
        normalized.includes('program_number')
      ) {
        continue
      }
      out[key] = removeSensitiveFields(v)
    }
    return out
  }

  return value
}

async function getParticipantUserIds(ownerUserId: string, tripId?: string): Promise<string[]> {
  if (!tripId) {
    return [ownerUserId]
  }

  const supabase = createSecretClient()
  const { data: collaborators } = await supabase
    .from('trip_collaborators')
    .select('user_id')
    .eq('trip_id', tripId)
    .not('accepted_at', 'is', null)
    .not('user_id', 'is', null)

  const set = new Set<string>([ownerUserId])
  for (const row of collaborators ?? []) {
    if (typeof row.user_id === 'string' && row.user_id) {
      set.add(row.user_id)
    }
  }

  return [...set]
}

async function queueDeliveriesForWebhooks(
  webhooks: WebhookRow[],
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<DispatchWebhookEventResult> {
  if (webhooks.length === 0) {
    return { webhookCount: 0, deliveryCount: 0 }
  }

  const supabase = createSecretClient()
  const timestamp = new Date().toISOString()
  const sanitizedData = removeSensitiveFields(data) as Record<string, unknown>

  const deliveries = webhooks.map((webhook) => {
    const deliveryId = crypto.randomUUID()
    const payload = buildWebhookDeliveryPayload({
      event,
      webhookId: webhook.id,
      deliveryId,
      timestamp,
      data: sanitizedData,
    })

    return {
      id: deliveryId,
      webhook_id: webhook.id,
      event,
      payload,
      status: 'pending',
      attempts: 0,
    }
  })

  const { error: deliveryError } = await supabase.from('webhook_deliveries').insert(deliveries)
  if (deliveryError) {
    console.error('[webhooks] failed to insert deliveries:', deliveryError)
    return { webhookCount: 0, deliveryCount: 0 }
  }

  const now = new Date().toISOString()
  const queueRows = deliveries.map((delivery) => ({
    webhook_id: delivery.webhook_id,
    delivery_id: delivery.id,
    attempt: DELIVERY_ATTEMPT_ONE,
    deliver_after: now,
  }))

  const { error: queueError } = await supabase.from('webhook_delivery_queue').insert(queueRows)
  if (queueError) {
    console.error('[webhooks] failed to enqueue deliveries:', queueError)
    return { webhookCount: webhooks.length, deliveryCount: 0 }
  }

  return { webhookCount: webhooks.length, deliveryCount: deliveries.length }
}

export async function dispatchWebhookEvent(
  params: DispatchWebhookEventParams
): Promise<DispatchWebhookEventResult> {
  const participantIds = await getParticipantUserIds(params.userId, params.tripId)

  const supabase = createSecretClient()
  const { data: webhooks, error } = await supabase
    .from('webhooks')
    .select('id, user_id, events')
    .in('user_id', participantIds)
    .eq('enabled', true)

  if (error) {
    console.error('[webhooks] failed to fetch matching webhooks:', error)
    return { webhookCount: 0, deliveryCount: 0 }
  }

  const subscribed = (webhooks ?? []).filter((w) => isSubscribed(w.events as string[] | null, params.event))
  return queueDeliveriesForWebhooks(subscribed as WebhookRow[], params.event, params.data)
}

export async function queueWebhookTestDelivery(
  webhookId: string,
  data: Record<string, unknown>
): Promise<{ queued: boolean }> {
  const supabase = createSecretClient()
  const { data: webhook, error } = await supabase
    .from('webhooks')
    .select('id, user_id, events')
    .eq('id', webhookId)
    .maybeSingle()

  if (error || !webhook) {
    return { queued: false }
  }

  const result = await queueDeliveriesForWebhooks([
    {
      id: webhook.id as string,
      user_id: webhook.user_id as string,
      events: webhook.events as string[] | null,
    },
  ], 'ping', data)

  return { queued: result.deliveryCount > 0 }
}
