/**
 * GET /api/v1/items/:id/source - Get the source email for one owned item.
 *
 * This is intentionally separate from GET /items/:id because normal item
 * responses strip sensitive booking fields. Agents need an explicit,
 * authenticated way to inspect the original booking source.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createUserScopedClient } from '@/lib/supabase/user-scoped'
import { isValidUUID } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const { id: itemId } = await params
  if (!isValidUUID(itemId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Item ID must be a valid UUID.' } },
      { status: 400 }
    )
  }

  const supabase = await createUserScopedClient(auth.userId)

  const { data: item, error: itemError } = await supabase
    .from('trip_items')
    .select(
      `id,
       trip_id,
       kind,
       provider,
       summary,
       confirmation_code,
       details_json,
       source_email_id`
    )
    .eq('id', itemId)
    .eq('user_id', auth.userId)
    .single()

  if (itemError || !item) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Item not found.' } },
      { status: 404 }
    )
  }

  if (!item.source_email_id) {
    return NextResponse.json({
      data: {
        item,
        source_email: null,
      },
    })
  }

  const { data: sourceEmail, error: emailError } = await supabase
    .from('source_emails')
    .select(
      `id,
       from_email,
       to_email,
       subject,
       body_text,
       attachment_text,
       received_at,
       resend_message_id,
       attachments_json,
       parse_status,
       parse_error,
       extracted_json`
    )
    .eq('id', item.source_email_id)
    .eq('user_id', auth.userId)
    .single()

  if (emailError || !sourceEmail) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Source email not found.' } },
      { status: 404 }
    )
  }

  return NextResponse.json({
    data: {
      item,
      source_email: sourceEmail,
    },
  })
}
