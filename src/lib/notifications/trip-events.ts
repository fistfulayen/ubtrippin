import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTripUpdateEmail } from '@/lib/email/trip-update'
import { createUserScopedClient } from '@/lib/supabase/user-scoped'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ubtrippin.xyz'
const TRIP_UPDATE_DEBOUNCE_MS = 5 * 60 * 1000

export interface TripUpdateChange {
  kind: string
  summary: string
}

interface TripUpdateLogRow {
  id: string
  actor_id: string
  event_data: unknown
}

interface NotificationRecipientRow {
  user_id: string
  email: string
}

type DbClient = SupabaseClient

export async function logTripEvent(
  supabase: DbClient,
  tripId: string,
  actorId: string,
  eventType: string,
  eventData: Record<string, unknown>
) {
  const { error } = await supabase
    .from('trip_update_log')
    .insert({
      trip_id: tripId,
      actor_id: actorId,
      event_type: eventType,
      event_data: eventData,
    })

  if (error) {
    throw new Error(`Failed to log trip event: ${error.message}`)
  }
}

export async function getNotificationRecipients(
  supabase: DbClient,
  tripId: string,
  actorId: string
) {
  const { data, error } = await supabase.rpc(
    'get_trip_update_notification_recipients',
    {
      p_trip_id: tripId,
      p_actor_id: actorId,
    }
  )

  if (error) {
    throw new Error(`Failed to fetch trip update recipients: ${error.message}`)
  }

  return (data ?? []) as NotificationRecipientRow[]
}

export async function processPendingNotifications(
  supabase: DbClient,
  tripId: string
) {
  const { data: pendingRows, error: pendingError } = await supabase.rpc(
    'get_pending_trip_update_events',
    { p_trip_id: tripId }
  )

  if (pendingError) {
    throw new Error(`Failed to fetch pending trip updates: ${pendingError.message}`)
  }

  const pendingEvents = (pendingRows ?? []) as TripUpdateLogRow[]
  if (pendingEvents.length === 0) {
    return
  }

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, title')
    .eq('id', tripId)
    .maybeSingle()

  if (tripError) {
    throw new Error(`Failed to fetch trip details: ${tripError.message}`)
  }

  if (!trip) {
    return
  }

  const { data: audienceRows, error: audienceError } = await supabase.rpc(
    'get_trip_update_notification_recipients',
    {
      p_trip_id: tripId,
      p_actor_id: null,
    }
  )

  if (audienceError) {
    throw new Error(`Failed to fetch trip update audience: ${audienceError.message}`)
  }

  const audience = (audienceRows ?? []) as NotificationRecipientRow[]
  const tripUrl = `${APP_URL}/trips/${tripId}`
  const unsubscribeUrl = `${APP_URL}/settings`

  await Promise.all(
    audience.map(async (recipient) => {
      const visibleEvents = pendingEvents.filter((event) => event.actor_id !== recipient.user_id)
      if (visibleEvents.length === 0) {
        return
      }

      const changes = visibleEvents.flatMap((event) => getEventChanges(event.event_data))
      if (changes.length === 0) {
        return
      }

      const actorNames = [...new Set(
        visibleEvents
          .map((event) => getActorName(event.event_data))
          .filter((name): name is string => !!name)
      )]

      await sendTripUpdateEmail({
        to: recipient.email,
        tripTitle: trip.title,
        actorName: actorNames.length === 1 ? actorNames[0] : 'Your trip group',
        changes,
        tripUrl,
        unsubscribeUrl,
      })
    })
  )

  const eventIds = pendingEvents.map((event) => event.id)
  const { error: markError } = await supabase.rpc('mark_trip_update_events_notified', {
    p_trip_id: tripId,
    p_event_ids: eventIds,
  })

  if (markError) {
    throw new Error(`Failed to mark trip updates as notified: ${markError.message}`)
  }
}

export function scheduleTripNotificationProcessing(userId: string, tripId: string) {
  const timeout = setTimeout(() => {
    void (async () => {
      const supabase = await createUserScopedClient(userId)
      await processPendingNotifications(supabase as DbClient, tripId)
    })().catch((error) => {
      console.error('[trip-notifications/process]', error)
    })
  }, TRIP_UPDATE_DEBOUNCE_MS)

  if (typeof timeout.unref === 'function') {
    timeout.unref()
  }
}

function getEventChanges(eventData: unknown): TripUpdateChange[] {
  if (!isRecord(eventData) || !Array.isArray(eventData.changes)) {
    return []
  }

  return eventData.changes
    .map((change) => {
      if (!isRecord(change)) return null
      const kind = typeof change.kind === 'string' ? change.kind : null
      const summary = typeof change.summary === 'string' ? change.summary : null
      if (!kind || !summary) return null
      return { kind, summary }
    })
    .filter((change): change is TripUpdateChange => change !== null)
}

function getActorName(eventData: unknown) {
  if (!isRecord(eventData) || typeof eventData.actor_name !== 'string') {
    return null
  }

  return eventData.actor_name.trim() || null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
