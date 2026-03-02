import { NextResponse } from 'next/server'
import { getEarlyAdopterSpotsRemaining, getProSubscriberCount } from '@/lib/billing'
import { stripe } from '@/lib/stripe'
import { requireSessionAuth, isSessionAuthError } from '@/lib/api/session-auth'

interface ProfileRow {
  subscription_tier: string | null
  subscription_current_period_end: string | null
  subscription_grace_until: string | null
  stripe_subscription_id: string | null
}

interface SubscriptionPriceSummary {
  id: string
  amount: number | null
  currency: string
  interval: 'day' | 'week' | 'month' | 'year' | null
}

async function fetchCurrentSubscriptionPrice(
  stripeSubscriptionId: string | null
): Promise<SubscriptionPriceSummary | null> {
  if (!stripeSubscriptionId) {
    return null
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
    const price = subscription.items.data[0]?.price

    if (!price) {
      return null
    }

    return {
      id: price.id,
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval ?? null,
    }
  } catch (error) {
    console.error('[v1/billing/subscription] subscription price lookup failed:', error)
    return null
  }
}

export async function GET() {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  const { data: profileData, error: profileError } = await auth.supabase
    .from('profiles')
    .select('subscription_tier, subscription_current_period_end, subscription_grace_until, stripe_subscription_id')
    .eq('id', auth.userId)
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
    proSubscriberCount = await getProSubscriberCount(auth.supabase)
  } catch (error) {
    console.error('[v1/billing/subscription] count failed:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch subscription.' } },
      { status: 500 }
    )
  }

  const profile = profileData as ProfileRow
  const currentPrice = await fetchCurrentSubscriptionPrice(profile.stripe_subscription_id)

  return NextResponse.json({
    subscription_tier: profile.subscription_tier ?? 'free',
    subscription_current_period_end: profile.subscription_current_period_end,
    subscription_grace_until: profile.subscription_grace_until,
    current_price: currentPrice,
    earlyAdopterSpotsRemaining: getEarlyAdopterSpotsRemaining(proSubscriberCount),
  })
}
