/**
 * GET  /api/v1/notifications         — List notifications for the authenticated user
 * POST /api/v1/notifications/read    — Mark all as read
 *
 * Query params:
 *   ?unread=true   — only unread notifications (default: false)
 *   ?limit=N       — max results (default 20, max 100)
 *
 * Response: { data: Notification[], meta: { count, unread_count } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createUserScopedClient } from '@/lib/supabase/user-scoped'

export async function GET(request: NextRequest) {
  // 1. Authenticate
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  // 2. Rate limit
  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get('unread') === 'true'
  const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10)
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 20 : rawLimit), 100)

  const supabase = await createUserScopedClient(auth.userId)

  let query = supabase
    .from('notifications')
    .select('id, type, trip_id, actor_id, data, read_at, created_at')
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) {
    query = query.is('read_at', null)
  }

  const { data: notifications, error } = await query

  if (error) {
    console.error('[v1/notifications] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch notifications.' } },
      { status: 500 }
    )
  }

  // Unread count (quick separate query for accuracy even in non-unread mode)
  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.userId)
    .is('read_at', null)

  return NextResponse.json({
    data: notifications ?? [],
    meta: {
      count: (notifications ?? []).length,
      unread_count: unreadCount ?? 0,
    },
  })
}
