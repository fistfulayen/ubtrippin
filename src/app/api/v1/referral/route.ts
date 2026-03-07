import { NextResponse } from 'next/server'
import { requireSessionAuth, isSessionAuthError } from '@/lib/api/session-auth'

interface ReferralStatsResponse {
  referral_code: string
  referral_link: string
  signed_up_count: number
  converted_count: number
}

function appOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://ubtrippin.xyz'
}

export async function GET() {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  const { data: profile, error: profileError } = await auth.supabase
    .from('profiles')
    .select('referral_code')
    .eq('id', auth.userId)
    .maybeSingle()

  if (profileError || !profile?.referral_code) {
    console.error('[v1/referral GET] failed to load referral code', profileError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to load referral profile.' } },
      { status: 500 }
    )
  }

  const [{ count: signedUpCount }, { count: convertedCount }] = await Promise.all([
    auth.supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', auth.userId)
      .in('status', ['signed_up', 'converted']),
    auth.supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', auth.userId)
      .eq('status', 'converted'),
  ])

  const payload: ReferralStatsResponse = {
    referral_code: profile.referral_code,
    referral_link: `${appOrigin().replace(/\/$/, '')}/r/${profile.referral_code}`,
    signed_up_count: signedUpCount ?? 0,
    converted_count: convertedCount ?? 0,
  }

  return NextResponse.json({ data: payload })
}
