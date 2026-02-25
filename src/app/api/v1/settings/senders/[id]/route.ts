/**
 * DELETE /api/v1/settings/senders/:id — Remove an allowed sender
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createSecretClient } from '@/lib/supabase/service'
import { isValidUUID } from '@/lib/validation'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Authenticate
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  // 2. Rate limit
  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  // 3. Validate param
  const { id: senderId } = await params
  if (!isValidUUID(senderId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Sender ID must be a valid UUID.' } },
      { status: 400 }
    )
  }

  const supabase = createSecretClient()

  // 4. Verify ownership before deleting
  const { data: existing } = await supabase
    .from('allowed_senders')
    .select('id')
    .eq('id', senderId)
    .eq('user_id', auth.userId)
    .single()

  if (!existing) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Sender not found.' } },
      { status: 404 }
    )
  }

  // 5. Delete
  const { error } = await supabase
    .from('allowed_senders')
    .delete()
    .eq('id', senderId)
    .eq('user_id', auth.userId)

  if (error) {
    console.error('[v1/settings/senders/[id] DELETE] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to delete sender.' } },
      { status: 500 }
    )
  }

  return new NextResponse(null, { status: 204 })
}
