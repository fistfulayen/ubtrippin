import type { SupabaseClient } from '@supabase/supabase-js'

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const normalized = raw.trim().toUpperCase()
  if (!/^[A-Z0-9]{6,32}$/.test(normalized)) return null
  return normalized
}

export async function resolveReferrerIdByCode(
  supabase: SupabaseClient,
  code: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('resolve_referrer_id_by_code', {
    input_code: code,
  })

  if (error) {
    console.error('[referrals] resolve_referrer_id_by_code failed', error)
    return null
  }

  return typeof data === 'string' ? data : null
}

export async function upsertSignedUpReferral(
  supabase: SupabaseClient,
  referrerId: string,
  refereeId: string
): Promise<void> {
  const { error } = await supabase.from('referrals').upsert(
    {
      referrer_id: referrerId,
      referee_id: refereeId,
      status: 'signed_up',
      converted_at: null,
    },
    {
      onConflict: 'referee_id',
      ignoreDuplicates: false,
    }
  )

  if (error) {
    console.error('[referrals] upsert signed_up failed', error)
  }
}

export async function markReferralConverted(
  supabase: SupabaseClient,
  refereeId: string
): Promise<void> {
  const { error } = await supabase
    .from('referrals')
    .update({
      status: 'converted',
      converted_at: new Date().toISOString(),
    })
    .eq('referee_id', refereeId)
    .neq('status', 'converted')

  if (error) {
    console.error('[referrals] mark converted failed', error)
  }
}
