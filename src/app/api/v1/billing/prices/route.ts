import { NextResponse } from 'next/server'
import { getEarlyAdopterSpotsRemaining, getProSubscriberCount } from '@/lib/billing'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const monthlyPriceId = process.env.STRIPE_PRICE_MONTHLY
  const annualPriceId = process.env.STRIPE_PRICE_ANNUAL
  const earlyAdopterPriceId = process.env.STRIPE_PRICE_EARLY_ADOPTER

  if (!monthlyPriceId || !annualPriceId || !earlyAdopterPriceId) {
    return NextResponse.json(
      { error: { code: 'server_misconfigured', message: 'Stripe prices are not configured.' } },
      { status: 500 }
    )
  }

  const supabase = await createClient()

  let proSubscriberCount = 0
  try {
    proSubscriberCount = await getProSubscriberCount(supabase)
  } catch (error) {
    console.error('[v1/billing/prices] count failed:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch prices.' } },
      { status: 500 }
    )
  }

  const spotsRemaining = getEarlyAdopterSpotsRemaining(proSubscriberCount)

  return NextResponse.json({
    prices: [
      { id: monthlyPriceId, name: 'Monthly', amount: 299, interval: 'month' },
      { id: annualPriceId, name: 'Annual', amount: 2499, interval: 'year' },
      {
        id: earlyAdopterPriceId,
        name: 'Early Adopter',
        amount: 1000,
        interval: 'year',
        available: spotsRemaining > 0,
        spotsRemaining,
      },
    ],
  })
}
