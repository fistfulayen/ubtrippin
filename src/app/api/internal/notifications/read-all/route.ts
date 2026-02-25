/**
 * POST /api/internal/notifications/read-all — Mark all notifications as read for the session user
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSecretClient } from '@/lib/supabase/server'

export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const secret = createSecretClient()

  await secret
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)

  return NextResponse.json({ ok: true })
}
