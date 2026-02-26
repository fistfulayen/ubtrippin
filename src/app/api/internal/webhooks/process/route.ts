/**
 * POST /api/internal/webhooks/process
 *
 * Pull due queue entries and attempt webhook deliveries.
 * Can be called by cron (Vercel/Supabase) and returns a processing summary.
 */

import crypto from 'crypto'

import { NextRequest, NextResponse } from 'next/server'

import { createSecretClient } from '@/lib/supabase/service'
import { decryptWebhookSecret } from '@/lib/webhook-crypto'

const REQUEST_TIMEOUT_MS = 10_000
const MAX_QUEUE_FETCH = 500
const PER_USER_CONCURRENCY = 10
const MAX_RESPONSE_BODY_CHARS = 500
const RETRY_DELAYS_MS: Record<number, number> = {
  2: 1_000,
  3: 10_000,
  4: 60_000,
}

function signPayload(payload: string, secret: string): string {
  const digest = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return `sha256=${digest}`
}

function truncateResponseBody(body: string): string {
  if (body.length <= MAX_RESPONSE_BODY_CHARS) return body
  return body.slice(0, MAX_RESPONSE_BODY_CHARS)
}

function firstRow(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return (value[0] as Record<string, unknown>) ?? null
  }
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>
  }
  return null
}

async function deliverOne(queueRow: Record<string, unknown>): Promise<'success' | 'failed' | 'requeued' | 'skipped'> {
  const queueId = queueRow.id as string
  const deliveryId = queueRow.delivery_id as string
  const attempt = Number(queueRow.attempt)

  const webhook = firstRow(queueRow.webhook)
  const delivery = firstRow(queueRow.delivery)

  if (!webhook || !delivery) {
    return 'skipped'
  }

  const supabase = createSecretClient()

  // Claim row atomically to avoid duplicate processing by overlapping workers.
  const { data: claim, error: claimError } = await supabase
    .from('webhook_delivery_queue')
    .delete()
    .eq('id', queueId)
    .select('id')
    .maybeSingle()

  if (claimError || !claim) {
    return 'skipped'
  }

  if (webhook.enabled !== true) {
    // Keep pending when disabled; retry later.
    await supabase.from('webhook_delivery_queue').insert({
      webhook_id: webhook.id,
      delivery_id: deliveryId,
      attempt,
      deliver_after: new Date(Date.now() + 30_000).toISOString(),
    })
    return 'requeued'
  }

  const body = JSON.stringify(delivery.payload)
  let responseCode: number | null = null
  let responseBody = ''
  let ok = false

  try {
    const secret = decryptWebhookSecret(webhook.secret_encrypted as string)
    const timestamp = Math.floor(Date.now() / 1000).toString()

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(webhook.url as string, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ubt-signature': signPayload(body, secret),
          'x-ubt-event': delivery.event as string,
          'x-ubt-delivery': deliveryId,
          'x-ubt-timestamp': timestamp,
        },
        body,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    responseCode = response.status
    responseBody = truncateResponseBody(await response.text())
    ok = response.ok
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown delivery error'
    responseBody = truncateResponseBody(message)
  }

  const nowIso = new Date().toISOString()

  if (ok) {
    await supabase
      .from('webhook_deliveries')
      .update({
        status: 'success',
        attempts: attempt,
        last_attempt_at: nowIso,
        last_response_code: responseCode,
        last_response_body: responseBody || null,
      })
      .eq('id', deliveryId)

    return 'success'
  }

  if (attempt < 4) {
    const nextAttempt = attempt + 1
    const delayMs = RETRY_DELAYS_MS[nextAttempt] ?? 1_000

    await supabase
      .from('webhook_deliveries')
      .update({
        status: 'pending',
        attempts: attempt,
        last_attempt_at: nowIso,
        last_response_code: responseCode,
        last_response_body: responseBody || null,
      })
      .eq('id', deliveryId)

    await supabase.from('webhook_delivery_queue').insert({
      webhook_id: webhook.id,
      delivery_id: deliveryId,
      attempt: nextAttempt,
      deliver_after: new Date(Date.now() + delayMs).toISOString(),
    })

    return 'requeued'
  }

  await supabase
    .from('webhook_deliveries')
    .update({
      status: 'failed',
      attempts: attempt,
      last_attempt_at: nowIso,
      last_response_code: responseCode,
      last_response_body: responseBody || null,
    })
    .eq('id', deliveryId)

  return 'failed'
}

async function processQueueBatch() {
  const supabase = createSecretClient()
  const nowIso = new Date().toISOString()

  await supabase
    .from('webhook_deliveries')
    .delete()
    .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

  const { data: dueRows, error } = await supabase
    .from('webhook_delivery_queue')
    .select(`
      id,
      webhook_id,
      delivery_id,
      attempt,
      deliver_after,
      webhook:webhooks(id, user_id, url, secret_encrypted, enabled),
      delivery:webhook_deliveries(id, event, payload)
    `)
    .lte('deliver_after', nowIso)
    .order('deliver_after', { ascending: true })
    .limit(MAX_QUEUE_FETCH)

  if (error) {
    throw new Error(`Failed to load queue entries: ${error.message}`)
  }

  const perUserCount = new Map<string, number>()
  const selectedRows: Record<string, unknown>[] = []

  for (const row of dueRows ?? []) {
    const webhook = firstRow(row.webhook)
    const userId = (webhook?.user_id as string | undefined) ?? ''
    if (!userId) continue

    const current = perUserCount.get(userId) ?? 0
    if (current >= PER_USER_CONCURRENCY) {
      continue
    }

    perUserCount.set(userId, current + 1)
    selectedRows.push(row as Record<string, unknown>)
  }

  const outcomes = await Promise.all(selectedRows.map((row) => deliverOne(row)))

  return {
    fetched: (dueRows ?? []).length,
    processed: selectedRows.length,
    success: outcomes.filter((o) => o === 'success').length,
    failed: outcomes.filter((o) => o === 'failed').length,
    requeued: outcomes.filter((o) => o === 'requeued').length,
    skipped: outcomes.filter((o) => o === 'skipped').length,
  }
}

function hasValidCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

export async function POST(request: NextRequest) {
  if (!hasValidCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processQueueBatch()
    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[internal/webhooks/process]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
