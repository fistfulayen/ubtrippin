/**
 * PATCH /api/v1/notifications/:id — Mark a notification as read
 *
 * Body: {} (no body needed — just marks read_at = now)
 * Response: { data: { id, read_at } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createSecretClient } from '@/lib/supabase/service'
import { isValidUUID } from '@/lib/validation'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Notification ID must be a valid UUID.' } },
      { status: 400 }
    )
  }

  const supabase = createSecretClient()

  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', auth.userId)
    .select('id, read_at')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Notification not found.' } },
      { status: 404 }
    )
  }

  return NextResponse.json({ data })
}
