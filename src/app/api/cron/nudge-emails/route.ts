/**
 * GET /api/cron/nudge-emails
 *
 * Cron endpoint to send nudge emails to unactivated users.
 * Called by Vercel Cron (or any external scheduler).
 *
 * Auth: Bearer $CRON_SECRET header (skipped if CRON_SECRET is not set).
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAndSendNudges } from '@/lib/nudge-emails'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const sent = await checkAndSendNudges()
    return NextResponse.json({ sent })
  } catch (err) {
    console.error('[cron/nudge-emails] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
