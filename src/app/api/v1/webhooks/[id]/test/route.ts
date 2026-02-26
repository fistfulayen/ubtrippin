/**
 * POST /api/v1/webhooks/:id/test — Queue a synthetic ping delivery
 */

import { NextRequest, NextResponse } from 'next/server'

import { authenticateWebhookRequest, isWebhookAuthError } from '@/lib/api/webhook-auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createSecretClient } from '@/lib/supabase/service'
import { isValidUUID } from '@/lib/validation'
import { queueWebhookTestDelivery } from '@/lib/webhooks'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
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

  const supabase = createSecretClient()
  const { data: webhook } = await supabase
    .from('webhooks')
    .select('id, url')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .maybeSingle()

  if (!webhook) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Webhook not found.' } },
      { status: 404 }
    )
  }

  const result = await queueWebhookTestDelivery(id, {
    message: 'Synthetic ping from UB Trippin webhook test endpoint.',
  })

  if (!result.queued) {
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to queue test delivery.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: { queued: true, webhook_id: id } })
}
