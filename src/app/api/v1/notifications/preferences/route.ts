import { NextRequest, NextResponse } from 'next/server'
import { isSessionAuthError, requireSessionAuth } from '@/lib/api/session-auth'

const DEFAULT_PREFERENCES = { trip_updates: true }

export async function GET() {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  const { data: profile, error } = await auth.supabase
    .from('profiles')
    .select('notification_preferences')
    .eq('id', auth.userId)
    .single()

  if (error) {
    console.error('[v1/notifications/preferences GET]', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch notification preferences.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({
    data: normalizePreferences(profile?.notification_preferences),
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  const body = (await request.json().catch(() => null)) as
    | { trip_updates?: unknown; notification_preferences?: { trip_updates?: unknown } }
    | null

  const rawTripUpdates = body?.notification_preferences?.trip_updates ?? body?.trip_updates
  if (typeof rawTripUpdates !== 'boolean') {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: '"trip_updates" must be a boolean.' } },
      { status: 400 }
    )
  }

  const notificationPreferences = {
    trip_updates: rawTripUpdates,
  }

  const { data: profile, error } = await auth.supabase
    .from('profiles')
    .update({ notification_preferences: notificationPreferences })
    .eq('id', auth.userId)
    .select('notification_preferences')
    .single()

  if (error) {
    console.error('[v1/notifications/preferences PATCH]', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to update notification preferences.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({
    data: normalizePreferences(profile?.notification_preferences),
  })
}

function normalizePreferences(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_PREFERENCES
  }

  const tripUpdates = 'trip_updates' in value && typeof value.trip_updates === 'boolean'
    ? value.trip_updates
    : DEFAULT_PREFERENCES.trip_updates

  return {
    trip_updates: tripUpdates,
  }
}
