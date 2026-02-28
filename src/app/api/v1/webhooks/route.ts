/**
 * GET  /api/v1/webhooks — List user's webhooks
 * POST /api/v1/webhooks — Register a webhook
 */

import { NextRequest, NextResponse } from 'next/server'

import { authenticateWebhookRequest, isWebhookAuthError } from '@/lib/api/webhook-auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createUserScopedClient } from '@/lib/supabase/user-scoped'
import { encryptWebhookSecret, maskWebhookSecret } from '@/lib/webhook-crypto'
import { validateWebhookUrl } from '@/lib/webhook-url'
import { WEBHOOK_EVENTS } from '@/lib/webhooks'
import { getUserTier } from '@/lib/usage/limits'

const FREE_WEBHOOK_LIMIT = 0
const PRO_WEBHOOK_LIMIT = 10

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

export async function GET(request: NextRequest) {
  const auth = await authenticateWebhookRequest(request)
  if (isWebhookAuthError(auth)) return auth

  if (auth.keyHash) {
    const limited = rateLimitResponse(auth.keyHash)
    if (limited) return limited
  }

  const supabase = await createUserScopedClient(auth.userId)
  const { data, error } = await supabase
    .from('webhooks')
    .select('id, user_id, url, description, secret_masked, events, enabled, created_at, updated_at')
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[v1/webhooks GET]', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch webhooks.' } },
      { status: 500 }
    )
  }

  const list = (data ?? []).map((row) => sanitizeWebhook(row as Record<string, unknown>))

  return NextResponse.json({
    data: list,
    meta: { count: list.length },
  })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateWebhookRequest(request)
  if (isWebhookAuthError(auth)) return auth

  if (auth.keyHash) {
    const limited = rateLimitResponse(auth.keyHash)
    if (limited) return limited
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

  if (typeof body.url !== 'string') {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: '"url" is required.', field: 'url' } },
      { status: 400 }
    )
  }

  const urlValidation = await validateWebhookUrl(body.url)
  if (!urlValidation.ok) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: urlValidation.message, field: 'url' } },
      { status: 400 }
    )
  }

  const secret = typeof body.secret === 'string' ? body.secret.trim() : ''
  if (!secret || secret.length > 200) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_param',
          message: '"secret" is required and must be 1-200 characters.',
          field: 'secret',
        },
      },
      { status: 400 }
    )
  }

  const description =
    body.description === undefined || body.description === null
      ? null
      : typeof body.description === 'string'
        ? stripHtml(body.description).slice(0, 200) || null
        : null

  if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: '"description" must be a string.', field: 'description' } },
      { status: 400 }
    )
  }

  if (body.events !== undefined && !isValidEvents(body.events)) {
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

  const events = normalizeEvents(body.events)

  const supabase = await createUserScopedClient(auth.userId)
  const tier = await getUserTier(auth.userId, supabase)
  const maxWebhooks = tier === 'pro' ? PRO_WEBHOOK_LIMIT : FREE_WEBHOOK_LIMIT

  const { count } = await supabase
    .from('webhooks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.userId)

  const used = count ?? 0
  if (used >= maxWebhooks) {
    return NextResponse.json(
      {
        error: {
          code: 'limit_exceeded',
          message:
            tier === 'pro'
              ? `Pro tier supports up to ${PRO_WEBHOOK_LIMIT} webhooks.`
              : 'Webhook registration is a Pro feature. Upgrade to register signed webhook endpoints.',
        },
      },
      { status: 403 }
    )
  }

  const encrypted = encryptWebhookSecret(secret)
  const masked = maskWebhookSecret(secret)

  const { data, error } = await supabase
    .from('webhooks')
    .insert({
      user_id: auth.userId,
      url: urlValidation.normalizedUrl,
      description,
      secret_encrypted: encrypted,
      secret_masked: masked,
      events,
      enabled: true,
    })
    .select('id, user_id, url, description, secret_masked, events, enabled, created_at, updated_at')
    .single()

  if (error || !data) {
    console.error('[v1/webhooks POST]', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create webhook.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: sanitizeWebhook(data as Record<string, unknown>) }, { status: 201 })
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'GET, POST, OPTIONS',
    },
  })
}
