/**
 * GET /api/v1/webhooks/:id/deliveries — List recent delivery logs for a webhook
 */

import { NextRequest, NextResponse } from 'next/server'

import { authenticateWebhookRequest, isWebhookAuthError } from '@/lib/api/webhook-auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createUserScopedClient } from '@/lib/supabase/user-scoped'
import { getUserTier } from '@/lib/usage/limits'
import { isValidUUID } from '@/lib/validation'

type Params = { params: Promise<{ id: string }> }

const FREE_DELIVERY_LOG_LIMIT = 10
const PRO_DELIVERY_LOG_LIMIT = 100

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

  const supabase = await createUserScopedClient(auth.userId)

  const { data: webhook } = await supabase
    .from('webhooks')
    .select('id')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .maybeSingle()

  if (!webhook) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Webhook not found.' } },
      { status: 404 }
    )
  }

  const tier = await getUserTier(auth.userId, supabase)
  const limit = tier === 'pro' ? PRO_DELIVERY_LOG_LIMIT : FREE_DELIVERY_LOG_LIMIT

  const { data, error } = await supabase
    .from('webhook_deliveries')
    .select('id, webhook_id, event, payload, status, attempts, last_attempt_at, last_response_code, last_response_body, created_at')
    .eq('webhook_id', id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[v1/webhooks/:id/deliveries GET]', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch delivery logs.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({
    data: data ?? [],
    meta: {
      count: (data ?? []).length,
      limit,
      tier,
    },
  })
}
