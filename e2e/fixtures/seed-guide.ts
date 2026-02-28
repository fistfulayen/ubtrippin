/**
 * Seed a test city guide directly via Supabase admin (bypasses app UI).
 * Returns the guide ID. Caller is responsible for cleanup.
 */

import { adminClient } from '../helpers/supabase-admin'

export interface SeedGuideOptions {
  userId: string
  city?: string
  country?: string
  countryCode?: string
}

export interface SeedEntryOptions {
  guideId: string
  userId: string
  name?: string
  category?: string
  status?: 'visited' | 'to_try'
  description?: string
  address?: string
}

export async function seedGuide(opts: SeedGuideOptions): Promise<string> {
  const supabase = adminClient()

  const { data, error } = await supabase
    .from('city_guides')
    .insert({
      user_id: opts.userId,
      city: opts.city ?? 'E2E Test City',
      country: opts.country ?? 'Japan',
      country_code: opts.countryCode ?? 'JP',
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`seed-guide: failed to insert guide — ${error?.message}`)
  }

  return data.id as string
}

export async function seedGuideEntry(opts: SeedEntryOptions): Promise<string> {
  const supabase = adminClient()

  const { data, error } = await supabase
    .from('guide_entries')
    .insert({
      user_id: opts.userId,
      guide_id: opts.guideId,
      name: opts.name ?? 'E2E Test Cafe',
      category: opts.category ?? 'coffee',
      status: opts.status ?? 'visited',
      description: opts.description ?? 'Excellent espresso',
      address: opts.address ?? '1-1 Shinjuku, Tokyo',
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`seed-guide: failed to insert entry — ${error?.message}`)
  }

  return data.id as string
}

export async function deleteGuide(guideId: string): Promise<void> {
  const supabase = adminClient()
  // Cascade should handle entries, but belt + braces
  await supabase.from('guide_entries').delete().eq('guide_id', guideId)
  await supabase.from('city_guides').delete().eq('id', guideId)
}
