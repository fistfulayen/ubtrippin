import { createSecretClient } from '@/lib/supabase/service'
import type { SupabaseClient } from '@supabase/supabase-js'

export type SubscriptionTier = 'free' | 'pro'
type DbClient = SupabaseClient

const FREE_TRIP_LIMIT = 3
const FREE_EXTRACTION_LIMIT = 10

export interface LimitResult {
  allowed: boolean
  used: number
  /** null means unlimited */
  limit: number | null
}

export async function getUserTier(
  userId: string,
  supabase: DbClient = createSecretClient()
): Promise<SubscriptionTier> {
  const { data } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single()

  return (data?.subscription_tier as SubscriptionTier) ?? 'free'
}

/**
 * Check whether the user is allowed to extract another email this month.
 */
export async function checkExtractionLimit(
  userId: string,
  supabase: DbClient = createSecretClient()
): Promise<LimitResult> {
  const tier = await getUserTier(userId, supabase)

  if (tier === 'pro') {
    return { allowed: true, used: 0, limit: null }
  }

  const month = new Date().toISOString().slice(0, 7) // YYYY-MM

  const { data } = await supabase
    .from('monthly_extractions')
    .select('count')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle()

  const used = (data?.count as number) ?? 0

  return {
    allowed: used < FREE_EXTRACTION_LIMIT,
    used,
    limit: FREE_EXTRACTION_LIMIT,
  }
}

/**
 * Bump the monthly extraction counter for a user (upsert).
 */
export async function incrementExtractionCount(
  userId: string,
  supabase: DbClient = createSecretClient()
): Promise<void> {
  const month = new Date().toISOString().slice(0, 7) // YYYY-MM

  const { data: existing } = await supabase
    .from('monthly_extractions')
    .select('count')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('monthly_extractions')
      .update({ count: (existing.count as number) + 1 })
      .eq('user_id', userId)
      .eq('month', month)
  } else {
    await supabase
      .from('monthly_extractions')
      .insert({ user_id: userId, month, count: 1 })
  }
}

/**
 * Check whether the user is allowed to create another trip.
 */
export async function checkTripLimit(
  userId: string,
  supabase: DbClient = createSecretClient()
): Promise<LimitResult> {
  const tier = await getUserTier(userId, supabase)

  if (tier === 'pro') {
    return { allowed: true, used: 0, limit: null }
  }

  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('trips')
    .select('id, start_date, end_date')
    .eq('user_id', userId)

  const used = (data ?? []).filter((trip) => {
    const start = trip.start_date as string | null
    const end = trip.end_date as string | null
    if (!start) return true
    return (end ?? start) >= today
  }).length

  return {
    allowed: used < FREE_TRIP_LIMIT,
    used,
    limit: FREE_TRIP_LIMIT,
  }
}
