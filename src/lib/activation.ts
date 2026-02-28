/**
 * Activation event tracking for PRD 007-p1.
 *
 * Tracks key lifecycle milestones per user:
 *   first_forward_at  — first time they forwarded a booking email
 *   activated_at      — first trip created (1st meaningful action)
 *   second_trip_at    — second trip created
 */

import { createSecretClient } from '@/lib/supabase/service'
import type { SupabaseClient } from '@supabase/supabase-js'

type DbClient = SupabaseClient

/**
 * Called when the email ingest webhook successfully processes an email for a user.
 * Sets first_forward_at if it hasn't been set yet (idempotent).
 */
export async function trackFirstForward(
  userId: string,
  supabase: DbClient = createSecretClient()
): Promise<void> {

  // Only set if not already set — idempotent upsert
  await supabase
    .from('profiles')
    .update({ first_forward_at: new Date().toISOString() })
    .eq('id', userId)
    .is('first_forward_at', null)
}

/**
 * Called after a trip is successfully created (via email ingest or v1 API).
 * - If activated_at is not set: sets it now (first trip = activated)
 * - If activated_at already set: sets second_trip_at if not already set
 * Both operations are idempotent.
 */
export async function trackTripCreated(
  userId: string,
  supabase: DbClient = createSecretClient()
): Promise<void> {

  // Fetch current activation state
  const { data: profile } = await supabase
    .from('profiles')
    .select('activated_at, second_trip_at')
    .eq('id', userId)
    .single()

  if (!profile) return

  if (!profile.activated_at) {
    // First trip — mark as activated
    await supabase
      .from('profiles')
      .update({ activated_at: new Date().toISOString() })
      .eq('id', userId)
  } else if (!profile.second_trip_at) {
    // Second trip
    await supabase
      .from('profiles')
      .update({ second_trip_at: new Date().toISOString() })
      .eq('id', userId)
  }
  // If both are set, nothing more to track here
}
