import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { requireSessionAuth, isSessionAuthError } from '@/lib/api/session-auth'

interface ProfileRow {
  stripe_customer_id: string | null
}

function resolveOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://www.ubtrippin.xyz'
}

export async function GET() {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  const { data: profileData, error: profileError } = await auth.supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', auth.userId)
    .maybeSingle()

  if (profileError || !profileData) {
    console.error('[v1/billing/portal] profile lookup failed:', profileError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to load billing profile.' } },
      { status: 500 }
    )
  }

  const profile = profileData as ProfileRow
  if (!profile.stripe_customer_id) {
    return NextResponse.json(
      { error: { code: 'no_customer', message: 'No Stripe customer is linked to your account.' } },
      { status: 400 }
    )
  }

  const origin = resolveOrigin()

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/settings/billing`,
    })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[v1/billing/portal] Stripe API error:', error)
    return NextResponse.json(
      { error: { code: 'stripe_error', message: 'Failed to create portal session.' } },
      { status: 502 }
    )
  }
}
