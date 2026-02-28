/**
 * GET    /api/v1/webhooks/:id — Get webhook details
 * PATCH  /api/v1/webhooks/:id — Update webhook
 * DELETE /api/v1/webhooks/:id — Delete webhook and cancel pending deliveries
 */

import { NextRequest, NextResponse } from 'next/server'

import { authenticateWebhookRequest, isWebhookAuthError } from '@/lib/api/webhook-auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createUserScopedClient } from '@/lib/supabase/user-scoped'
import { encryptWebhookSecret, maskWebhookSecret } from '@/lib/webhook-crypto'
import { validateWebhookUrl } from '@/lib/webhook-url'
import { WEBHOOK_EVENTS } from '@/lib/webhooks'
import { isValidUUID } from '@/lib/validation'

type Params = { params: Promise<{ id: string }> }

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim()
}

function isValidEvents(input: unknown): input is string[] {
  if (!Array.isArray(input)) return false
  return input.every((event) => typeof event === 'string' && WEBHOOK_EVENTS.includes(event as never))
}

function normalizeEvents(input: unknown): string[] {
  if (input === undefined || input === null) return []
  if (!isValidEvents(input)) return []
  return [...new Set(input)]
}

function sanitizeWebhook(webhook: Record<string, unknown>): Record<string, unknown> {
  const { secret_encrypted, ...safe } = webhook
  return safe
}

async function getOwnedWebhookOr404(userId: string, webhookId: string) {
  const supabase = await createUserScopedClient(userId)
  const { data } = await supabase
    .from('webhooks')
    .select('id, user_id, url, description, secret_masked, events, enabled, created_at, updated_at')
    .eq('id', webhookId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) {
    return null
  }

  return data
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await authenticateWebhookRequest(request)
  if (isWebhookAuthError(auth)) return auth

  if (auth.keyHash) {
    const limited = rateLimitResponse(auth.keyHash)
    if (limited) return limited
  }

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Webhook ID must be a valid UUID.' } },
      { status: 400 }
    )
  }

  const webhook = await getOwnedWebhookOr404(auth.userId, id)
  if (!webhook) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Webhook not found.' } },
      { status: 404 }
    )
  }

  return NextResponse.json({ data: sanitizeWebhook(webhook as Record<string, unknown>) })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await authenticateWebhookRequest(request)
  if (isWebhookAuthError(auth)) return auth

  if (auth.keyHash) {
    const limited = rateLimitResponse(auth.keyHash)
    if (limited) return limited
  }

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Webhook ID must be a valid UUID.' } },
      { status: 400 }
    )
  }

  const existing = await getOwnedWebhookOr404(auth.userId, id)
  if (!existing) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Webhook not found.' } },
      { status: 404 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } },
      { status: 400 }
    )
  }

  const updates: Record<string, unknown> = {}

  if (body.url !== undefined) {
    if (typeof body.url !== 'string') {
      return NextResponse.json(
        { error: { code: 'invalid_param', message: '"url" must be a string.', field: 'url' } },
        { status: 400 }
      )
    }

    const validated = await validateWebhookUrl(body.url)
    if (!validated.ok) {
      return NextResponse.json(
        { error: { code: 'invalid_param', message: validated.message, field: 'url' } },
        { status: 400 }
      )
    }

    updates.url = validated.normalizedUrl
  }

  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== 'string') {
      return NextResponse.json(
        {
          error: {
            code: 'invalid_param',
            message: '"description" must be a string or null.',
            field: 'description',
          },
        },
        { status: 400 }
      )
    }

    updates.description =
      body.description === null ? null : stripHtml(body.description as string).slice(0, 200) || null
  }

  if (body.enabled !== undefined) {
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json(
        { error: { code: 'invalid_param', message: '"enabled" must be a boolean.', field: 'enabled' } },
        { status: 400 }
      )
    }

    updates.enabled = body.enabled
  }

  if (body.events !== undefined) {
    if (!isValidEvents(body.events)) {
      return NextResponse.json(
        {
          error: {
            code: 'invalid_param',
            message: `"events" must be an array of supported event names: ${WEBHOOK_EVENTS.join(', ')}`,
            field: 'events',
          },
        },
        { status: 400 }
      )
    }

    updates.events = normalizeEvents(body.events)
  }

  if (body.secret !== undefined) {
    if (typeof body.secret !== 'string') {
      return NextResponse.json(
        { error: { code: 'invalid_param', message: '"secret" must be a string.', field: 'secret' } },
        { status: 400 }
      )
    }

    const secret = body.secret.trim()
    if (!secret || secret.length > 200) {
      return NextResponse.json(
        {
          error: {
            code: 'invalid_param',
            message: '"secret" must be 1-200 characters.',
            field: 'secret',
          },
        },
        { status: 400 }
      )
    }

    updates.secret_encrypted = encryptWebhookSecret(secret)
    updates.secret_masked = maskWebhookSecret(secret)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'No updatable fields provided.' } },
      { status: 400 }
    )
  }

  const supabase = await createUserScopedClient(auth.userId)
  const { data, error } = await supabase
    .from('webhooks')
    .update(updates)
    .eq('id', id)
    .eq('user_id', auth.userId)
    .select('id, user_id, url, description, secret_masked, events, enabled, created_at, updated_at')
    .single()

  if (error || !data) {
    console.error('[v1/webhooks/:id PATCH]', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to update webhook.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: sanitizeWebhook(data as Record<string, unknown>) })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await authenticateWebhookRequest(request)
  if (isWebhookAuthError(auth)) return auth

  if (auth.keyHash) {
    const limited = rateLimitResponse(auth.keyHash)
    if (limited) return limited
  }

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Webhook ID must be a valid UUID.' } },
      { status: 400 }
    )
  }

  const existing = await getOwnedWebhookOr404(auth.userId, id)
  if (!existing) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Webhook not found.' } },
      { status: 404 }
    )
  }

  const supabase = await createUserScopedClient(auth.userId)

  await supabase.from('webhook_delivery_queue').delete().eq('webhook_id', id)

  const { error } = await supabase
    .from('webhooks')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.userId)

  if (error) {
    console.error('[v1/webhooks/:id DELETE]', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to delete webhook.' } },
      { status: 500 }
    )
  }

  return new NextResponse(null, { status: 204 })
}
