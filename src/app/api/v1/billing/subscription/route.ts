import { NextResponse } from 'next/server'
import { getEarlyAdopterSpotsRemaining, getProSubscriberCount } from '@/lib/billing'
import { createClient } from '@/lib/supabase/server'

interface ProfileRow {
  subscription_tier: string | null
  subscription_current_period_end: string | null
  subscription_grace_until: string | null
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required.' } },
      { status: 401 }
    )
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('subscription_tier, subscription_current_period_end, subscription_grace_until')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profileData) {
    console.error('[v1/billing/subscription] profile lookup failed:', profileError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch subscription.' } },
      { status: 500 }
    )
  }

  let proSubscriberCount = 0
  try {
    proSubscriberCount = await getProSubscriberCount(supabase)
  } catch (error) {
    console.error('[v1/billing/subscription] count failed:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch subscription.' } },
      { status: 500 }
    )
  }

  const profile = profileData as ProfileRow

  return NextResponse.json({
    subscription_tier: profile.subscription_tier ?? 'free',
    subscription_current_period_end: profile.subscription_current_period_end,
    subscription_grace_until: profile.subscription_grace_until,
    earlyAdopterSpotsRemaining: getEarlyAdopterSpotsRemaining(proSubscriberCount),
  })
}
