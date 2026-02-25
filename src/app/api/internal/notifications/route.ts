/**
 * GET  /api/internal/notifications — Fetch recent notifications for the session user
 * POST /api/internal/notifications/read-all — Mark all as read
 *
 * Session (cookie) auth only — for the UI notification bell.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSecretClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const secret = createSecretClient()

  const { data: notifications, error } = await secret
    .from('notifications')
    .select('id, type, trip_id, actor_id, data, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[internal/notifications GET]', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  const unreadCount = (notifications ?? []).filter((n) => !n.read_at).length

  return NextResponse.json({
    notifications: notifications ?? [],
    unread_count: unreadCount,
  })
}
