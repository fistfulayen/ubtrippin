import { NextRequest, NextResponse } from 'next/server'
import { getEarlyAdopterSpotsRemaining, getProSubscriberCount } from '@/lib/billing'
import { stripe } from '@/lib/stripe'
import { requireSessionAuth, isSessionAuthError } from '@/lib/api/session-auth'

interface CheckoutBody {
  priceId?: unknown
}

interface ProfileRow {
  id: string
  email: string | null
  full_name: string | null
  subscription_tier: string | null
  stripe_customer_id: string | null
}

function resolveOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://www.ubtrippin.xyz'
}

export async function POST(request: NextRequest) {
  const monthlyPriceId = process.env.STRIPE_PRICE_MONTHLY
  const annualPriceId = process.env.STRIPE_PRICE_ANNUAL
  const earlyAdopterPriceId = process.env.STRIPE_PRICE_EARLY_ADOPTER

  if (!monthlyPriceId || !annualPriceId || !earlyAdopterPriceId) {
    return NextResponse.json(
      { error: { code: 'server_misconfigured', message: 'Stripe prices are not configured.' } },
      { status: 500 }
    )
  }

  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  let body: CheckoutBody
  try {
    body = (await request.json()) as CheckoutBody
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } },
      { status: 400 }
    )
  }

  const requestedPriceId = typeof body.priceId === 'string' ? body.priceId.trim() : ''
  if (!requestedPriceId) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'priceId is required.' } },
      { status: 400 }
    )
  }

  const { data: profileData, error: profileError } = await auth.supabase
    .from('profiles')
    .select('id, email, full_name, subscription_tier, stripe_customer_id')
    .eq('id', auth.userId)
    .maybeSingle()

  if (profileError || !profileData) {
    console.error('[v1/checkout] profile lookup failed:', profileError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to load profile.' } },
      { status: 500 }
    )
  }

  const profile = profileData as ProfileRow

  if (profile.subscription_tier === 'pro') {
    return NextResponse.json(
      { error: { code: 'already_subscribed', message: 'You are already on Pro.' } },
      { status: 409 }
    )
  }

  let proSubscriberCount = 0
  try {
    proSubscriberCount = await getProSubscriberCount(auth.supabase)
  } catch (error) {
    console.error('[v1/checkout] pro subscriber count failed:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to check plan availability.' } },
      { status: 500 }
    )
  }

  const spotsRemaining = getEarlyAdopterSpotsRemaining(proSubscriberCount)
  const earlyAdopterAvailable = spotsRemaining > 0
  // Note: This check is best-effort. Under concurrent load, multiple users could start
  // checkout sessions that exceed the 100-seat early adopter cap. At our current scale
  // this is acceptable. If we approach 90+ subscribers, add a DB advisory lock or
  // Stripe coupon-based enforcement.

  const validPrices = new Set<string>([monthlyPriceId, annualPriceId])
  if (earlyAdopterAvailable) {
    validPrices.add(earlyAdopterPriceId)
  }

  if (!validPrices.has(requestedPriceId)) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_price',
          message: earlyAdopterAvailable
            ? 'Invalid priceId.'
            : 'Early adopter pricing is no longer available.',
        },
      },
      { status: 400 }
    )
  }

  let customerId = profile.stripe_customer_id

  if (!customerId) {
    let customer
    try {
      customer = await stripe.customers.create({
        email: profile.email ?? undefined,
        name: profile.full_name ?? undefined,
        metadata: {
          user_id: auth.userId,
        },
      })
    } catch (error) {
      console.error('[v1/checkout] Stripe customer creation failed:', error)
      return NextResponse.json(
        { error: { code: 'stripe_error', message: 'Failed to create Stripe customer.' } },
        { status: 502 }
      )
    }

    customerId = customer.id

    const { error: updateError } = await auth.supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', auth.userId)

    if (updateError) {
      console.error('[v1/checkout] failed storing stripe customer id:', updateError)
      return NextResponse.json(
        { error: { code: 'internal_error', message: 'Failed to update profile.' } },
        { status: 500 }
      )
    }
  }

  const origin = resolveOrigin()

  let session
  try {
    session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: auth.userId,
    line_items: [{ price: requestedPriceId, quantity: 1 }],
    success_url: `${origin}/settings/billing?upgraded=true`,
    cancel_url: `${origin}/settings/billing`,
    allow_promotion_codes: true,
    })
  } catch (error) {
    console.error('[v1/checkout] Stripe checkout session creation failed:', error)
    return NextResponse.json(
      { error: { code: 'stripe_error', message: 'Failed to create checkout session.' } },
      { status: 502 }
    )
  }

  if (!session.url) {
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Stripe checkout URL was not generated.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ url: session.url })
}
