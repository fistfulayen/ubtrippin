# Stripe Reference — February 2026 (Current)

This file contains verified current Stripe API patterns. Use these exactly — do NOT rely on training data.

## SDK Version
- `stripe` npm package: v20.x (latest)
- API version: `2025-12-15.clover`

## Stripe Client (Node.js / TypeScript)
```typescript
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
})
```

## Create Checkout Session (subscription mode)
```typescript
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer: stripeCustomerId, // existing customer, or omit to create new
  client_reference_id: userId, // your internal user ID
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${origin}/settings/billing?upgraded=true`,
  cancel_url: `${origin}/settings/billing`,
  allow_promotion_codes: true,
})
// Redirect to session.url
```

## Create Customer Portal Session
```typescript
const portalSession = await stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,
  return_url: `${origin}/settings/billing`,
})
// Redirect to portalSession.url
```

## Webhook Signature Verification (Next.js App Router)
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('[stripe webhook] signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Handle event by type
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      // session.client_reference_id = your user ID
      // session.customer = Stripe customer ID
      // session.subscription = Stripe subscription ID
      break
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      // subscription.status: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'paused' | etc.
      // subscription.current_period_end: Unix timestamp
      // subscription.items.data[0].price.id: the price ID
      break
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      // Subscription ended — downgrade user
      break
    }
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      // invoice.subscription: subscription ID
      // invoice.customer: customer ID
      // Renewal succeeded
      break
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      // Payment failed — start grace period
      break
    }
    default:
      // Log unhandled events
      console.log(`[stripe webhook] unhandled event: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
```

## Key Type References (Stripe v20.x)
- `Stripe.Checkout.Session` — checkout session object
- `Stripe.Subscription` — subscription object, has `.status`, `.current_period_end`, `.items`
- `Stripe.Invoice` — invoice object, has `.subscription`, `.customer`, `.status`
- `Stripe.Customer` — customer object, has `.email`, `.id`
- `Stripe.Event` — webhook event, has `.type`, `.data.object`

## Subscription Statuses (current as of 2026)
- `active` — subscription is current and paid
- `past_due` — latest invoice is past due
- `canceled` — subscription has been canceled
- `incomplete` — initial payment failed or requires action
- `incomplete_expired` — initial payment window expired
- `trialing` — in trial period
- `paused` — subscription is paused
- `unpaid` — latest invoice is unpaid and all retries exhausted

## Important Notes
- `constructEvent()` requires the RAW request body (string), NOT parsed JSON
- In Next.js App Router, use `request.text()` to get raw body
- `export const runtime = 'nodejs'` is required (Edge runtime doesn't support Stripe SDK)
- Customer portal URL comes from `stripe.billingPortal.sessions.create()`
- `client_reference_id` on checkout sessions is how you link back to your user
- Price amounts are in cents (2499 = $24.99)
- `current_period_end` is a Unix timestamp (seconds), convert with `new Date(ts * 1000)`
