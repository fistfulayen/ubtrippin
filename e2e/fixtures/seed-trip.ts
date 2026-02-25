/**
 * Seed a test trip directly via Supabase admin (bypasses app UI for speed).
 * Returns the trip ID. Caller is responsible for cleanup.
 */

import { adminClient } from '../helpers/supabase-admin'

export interface SeedTripOptions {
  userId: string
  title?: string
  startDate?: string
  endDate?: string
  primaryLocation?: string
}

export async function seedTrip(opts: SeedTripOptions): Promise<string> {
  const supabase = adminClient()

  const { data, error } = await supabase
    .from('trips')
    .insert({
      user_id: opts.userId,
      title: opts.title ?? 'E2E Test Trip — Kyoto',
      start_date: opts.startDate ?? '2027-04-01',
      end_date: opts.endDate ?? '2027-04-07',
      primary_location: opts.primaryLocation ?? 'Kyoto, Japan',
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`seed-trip: failed to insert — ${error?.message}`)
  }

  return data.id as string
}

export async function deleteTrip(tripId: string): Promise<void> {
  const supabase = adminClient()
  await supabase.from('trips').delete().eq('id', tripId)
}
