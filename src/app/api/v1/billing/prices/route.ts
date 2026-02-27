import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
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

  // Fetch live price data from Stripe
  try {
    const [monthly, annual, earlyAdopter] = await Promise.all([
      stripe.prices.retrieve(monthlyPriceId, { expand: ['product'] }),
      stripe.prices.retrieve(annualPriceId, { expand: ['product'] }),
      stripe.prices.retrieve(earlyAdopterPriceId, { expand: ['product'] }),
    ])

    const spotsRemaining = getEarlyAdopterSpotsRemaining(proSubscriberCount)

    const formatPrice = (price: typeof monthly) => ({
      id: price.id,
      name: typeof price.product === 'object' && 'name' in price.product ? price.product.name : price.id,
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval ?? null,
    })

    return NextResponse.json({
      prices: [
        formatPrice(monthly),
        formatPrice(annual),
        {
          ...formatPrice(earlyAdopter),
          available: spotsRemaining > 0,
          spotsRemaining,
        },
      ],
    })
  } catch (error) {
    console.error('[v1/billing/prices] Stripe API error:', error)
    return NextResponse.json(
      { error: { code: 'stripe_error', message: 'Failed to fetch prices from Stripe.' } },
      { status: 502 }
    )
  }
}
