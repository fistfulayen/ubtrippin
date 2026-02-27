import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

interface ProfileRow {
  stripe_customer_id: string | null
}

function resolveOrigin(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const protocol = request.headers.get('x-forwarded-proto') ?? 'https'

  if (host) {
    return `${protocol}://${host}`
  }

  return process.env.NEXT_PUBLIC_APP_URL || 'https://ubtrippin.xyz'
}

export async function GET(request: NextRequest) {
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
    .select('stripe_customer_id')
    .eq('id', user.id)
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

  const origin = resolveOrigin(request)
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${origin}/settings/billing`,
  })

  return NextResponse.json({ url: session.url })
}
