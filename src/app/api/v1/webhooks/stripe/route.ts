import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import {
  mapStripeSubscriptionStatusToTier,
  unixSecondsToIso,
} from '@/lib/billing'
import { stripe } from '@/lib/stripe'
import { createSecretClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GRACE_PERIOD_DAYS = 3

interface ProfileBillingRow {
  id: string
  email: string | null
  subscription_tier: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_current_period_end: string | null
  subscription_grace_until: string | null
}

type ProfilePatch = Partial<Pick<
  ProfileBillingRow,
  | 'email'
  | 'subscription_tier'
  | 'stripe_customer_id'
  | 'stripe_subscription_id'
  | 'subscription_current_period_end'
  | 'subscription_grace_until'
>>

const TIMESTAMP_FIELDS = new Set<keyof ProfilePatch>([
  'subscription_current_period_end',
  'subscription_grace_until',
])

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim().toLowerCase()
  return trimmed || null
}

function toStripeId(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object' && 'id' in value) {
    const withId = value as { id?: unknown }
    return typeof withId.id === 'string' ? withId.id : null
  }

  return null
}

function valuesEqual(field: keyof ProfilePatch, currentValue: unknown, nextValue: unknown): boolean {
  if (TIMESTAMP_FIELDS.has(field)) {
    if (currentValue == null && nextValue == null) {
      return true
    }

    if (typeof currentValue === 'string' && typeof nextValue === 'string') {
      return new Date(currentValue).getTime() === new Date(nextValue).getTime()
    }
  }

  return currentValue === nextValue
}

function buildProfileUpdates(profile: ProfileBillingRow, patch: ProfilePatch): ProfilePatch {
  const updates: ProfilePatch = {}

  for (const [field, nextValue] of Object.entries(patch) as Array<[keyof ProfilePatch, unknown]>) {
    if (nextValue === undefined) {
      continue
    }

    const currentValue = profile[field]
    if (!valuesEqual(field, currentValue, nextValue)) {
      updates[field] = nextValue as never
    }
  }

  return updates
}

async function applyProfilePatch(
  supabase: ReturnType<typeof createSecretClient>,
  profile: ProfileBillingRow,
  patch: ProfilePatch,
  context: string
) {
  const updates = buildProfileUpdates(profile, patch)
  if (Object.keys(updates).length === 0) {
    return
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id)
  if (error) {
    console.error(`[stripe webhook] ${context} update failed`, error)
  }
}

async function getProfileById(supabase: ReturnType<typeof createSecretClient>, id: string): Promise<ProfileBillingRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, subscription_tier, stripe_customer_id, stripe_subscription_id, subscription_current_period_end, subscription_grace_until'
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[stripe webhook] profile lookup by id failed', { id, error })
    return null
  }

  return (data as ProfileBillingRow | null) ?? null
}

async function getProfileByCustomerId(
  supabase: ReturnType<typeof createSecretClient>,
  customerId: string
): Promise<ProfileBillingRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, subscription_tier, stripe_customer_id, stripe_subscription_id, subscription_current_period_end, subscription_grace_until'
    )
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (error) {
    console.error('[stripe webhook] profile lookup by customer failed', { customerId, error })
    return null
  }

  return (data as ProfileBillingRow | null) ?? null
}

async function getProfileBySubscriptionId(
  supabase: ReturnType<typeof createSecretClient>,
  subscriptionId: string
): Promise<ProfileBillingRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, subscription_tier, stripe_customer_id, stripe_subscription_id, subscription_current_period_end, subscription_grace_until'
    )
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()

  if (error) {
    console.error('[stripe webhook] profile lookup by subscription failed', { subscriptionId, error })
    return null
  }

  return (data as ProfileBillingRow | null) ?? null
}

async function getProfileByEmail(
  supabase: ReturnType<typeof createSecretClient>,
  email: string
): Promise<ProfileBillingRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, subscription_tier, stripe_customer_id, stripe_subscription_id, subscription_current_period_end, subscription_grace_until'
    )
    .ilike('email', email)
    .maybeSingle()

  if (error) {
    console.error('[stripe webhook] profile lookup by email failed', { email, error })
    return null
  }

  return (data as ProfileBillingRow | null) ?? null
}

async function resolveProfile(
  supabase: ReturnType<typeof createSecretClient>,
  customerId: string | null,
  subscriptionId: string | null
): Promise<ProfileBillingRow | null> {
  if (subscriptionId) {
    const profile = await getProfileBySubscriptionId(supabase, subscriptionId)
    if (profile) {
      return profile
    }
  }

  if (customerId) {
    return getProfileByCustomerId(supabase, customerId)
  }

  return null
}

function getInvoicePeriodEnd(invoice: Stripe.Invoice): string | null {
  const invoiceWithLines = invoice as Stripe.Invoice & {
    period_end?: number | null
    lines?: {
      data?: Array<{
        period?: {
          end?: number | null
        }
      }>
    }
  }

  const fromLine = invoiceWithLines.lines?.data?.[0]?.period?.end
  if (typeof fromLine === 'number') {
    return unixSecondsToIso(fromLine)
  }

  if (typeof invoiceWithLines.period_end === 'number') {
    return unixSecondsToIso(invoiceWithLines.period_end)
  }

  return null
}

function graceUntilFromEventCreated(eventCreated: number): string {
  return new Date((eventCreated + GRACE_PERIOD_DAYS * 24 * 60 * 60) * 1000).toISOString()
}

async function getSubscriptionPeriodEnd(subscriptionId: string): Promise<string | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    return unixSecondsToIso(subscription.items.data[0]?.current_period_end)
  } catch (error) {
    console.error('[stripe webhook] failed to fetch subscription for period end', { subscriptionId, error })
    return null
  }
}

async function handleCheckoutSessionCompleted(
  supabase: ReturnType<typeof createSecretClient>,
  session: Stripe.Checkout.Session
) {
  const userId = session.client_reference_id
  if (!userId) {
    console.error('[stripe webhook] checkout.session.completed missing client_reference_id')
    return
  }

  const profile = await getProfileById(supabase, userId)
  if (!profile) {
    console.error('[stripe webhook] checkout.session.completed profile not found', { userId })
    return
  }

  await applyProfilePatch(
    supabase,
    profile,
    {
      subscription_tier: 'pro',
      stripe_customer_id: toStripeId(session.customer) ?? undefined,
      stripe_subscription_id: toStripeId(session.subscription) ?? undefined,
      subscription_grace_until: null,
    },
    'checkout.session.completed'
  )
}

async function handleCustomerCreated(
  supabase: ReturnType<typeof createSecretClient>,
  customer: Stripe.Customer
) {
  const email = normalizeEmail(customer.email)
  if (!email) {
    console.log('[stripe webhook] customer.created without email')
    return
  }

  const profile = await getProfileByEmail(supabase, email)
  if (!profile) {
    console.log('[stripe webhook] customer.created no matching profile', { email })
    return
  }

  await applyProfilePatch(
    supabase,
    profile,
    {
      stripe_customer_id: customer.id,
    },
    'customer.created'
  )
}

async function handleCustomerUpdated(
  supabase: ReturnType<typeof createSecretClient>,
  customer: Stripe.Customer | Stripe.DeletedCustomer
) {
  if ('deleted' in customer && customer.deleted) {
    console.log('[stripe webhook] customer.updated received deleted customer; skipping')
    return
  }

  const email = normalizeEmail(customer.email)
  let profile = await getProfileByCustomerId(supabase, customer.id)

  if (!profile && email) {
    profile = await getProfileByEmail(supabase, email)
  }

  if (!profile) {
    console.log('[stripe webhook] customer.updated no matching profile', { customerId: customer.id })
    return
  }

  await applyProfilePatch(
    supabase,
    profile,
    {
      stripe_customer_id: customer.id,
      email: email ?? undefined,
    },
    'customer.updated'
  )
}

async function handleSubscriptionCreated(
  supabase: ReturnType<typeof createSecretClient>,
  subscription: Stripe.Subscription
) {
  if (subscription.status === 'incomplete') {
    console.log('[stripe webhook] customer.subscription.created status=incomplete; no state change')
    return
  }

  if (subscription.status !== 'active') {
    console.log('[stripe webhook] customer.subscription.created non-active status; no state change', {
      status: subscription.status,
    })
    return
  }

  const customerId = toStripeId(subscription.customer)
  const profile = await resolveProfile(supabase, customerId, subscription.id)

  if (!profile) {
    console.log('[stripe webhook] customer.subscription.created no matching profile', {
      customerId,
      subscriptionId: subscription.id,
    })
    return
  }

  await applyProfilePatch(
    supabase,
    profile,
    {
      subscription_tier: 'pro',
      stripe_customer_id: customerId ?? undefined,
      stripe_subscription_id: subscription.id,
      subscription_current_period_end: unixSecondsToIso(subscription.items.data[0]?.current_period_end),
      subscription_grace_until: null,
    },
    'customer.subscription.created'
  )
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createSecretClient>,
  subscription: Stripe.Subscription
) {
  const customerId = toStripeId(subscription.customer)
  const profile = await resolveProfile(supabase, customerId, subscription.id)

  if (!profile) {
    console.log('[stripe webhook] customer.subscription.updated no matching profile', {
      customerId,
      subscriptionId: subscription.id,
    })
    return
  }

  const nextTier = mapStripeSubscriptionStatusToTier(subscription.status)

  await applyProfilePatch(
    supabase,
    profile,
    {
      subscription_tier: nextTier,
      stripe_customer_id: customerId ?? undefined,
      stripe_subscription_id: subscription.id,
      subscription_current_period_end: unixSecondsToIso(subscription.items.data[0]?.current_period_end),
      subscription_grace_until: nextTier === 'grace' ? undefined : null,
    },
    'customer.subscription.updated'
  )
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createSecretClient>,
  subscription: Stripe.Subscription
) {
  const customerId = toStripeId(subscription.customer)
  const profile = await resolveProfile(supabase, customerId, subscription.id)

  if (!profile) {
    console.log('[stripe webhook] customer.subscription.deleted no matching profile', {
      customerId,
      subscriptionId: subscription.id,
    })
    return
  }

  await applyProfilePatch(
    supabase,
    profile,
    {
      subscription_tier: 'free',
      stripe_subscription_id: null,
      subscription_current_period_end: null,
      subscription_grace_until: null,
    },
    'customer.subscription.deleted'
  )
}

async function handleSubscriptionPaused(
  supabase: ReturnType<typeof createSecretClient>,
  subscription: Stripe.Subscription
) {
  const customerId = toStripeId(subscription.customer)
  const profile = await resolveProfile(supabase, customerId, subscription.id)

  if (!profile) {
    console.log('[stripe webhook] customer.subscription.paused no matching profile', {
      customerId,
      subscriptionId: subscription.id,
    })
    return
  }

  await applyProfilePatch(
    supabase,
    profile,
    {
      subscription_tier: 'paused',
      stripe_customer_id: customerId ?? undefined,
      stripe_subscription_id: subscription.id,
    },
    'customer.subscription.paused'
  )
}

async function handleSubscriptionResumed(
  supabase: ReturnType<typeof createSecretClient>,
  subscription: Stripe.Subscription
) {
  const customerId = toStripeId(subscription.customer)
  const profile = await resolveProfile(supabase, customerId, subscription.id)

  if (!profile) {
    console.log('[stripe webhook] customer.subscription.resumed no matching profile', {
      customerId,
      subscriptionId: subscription.id,
    })
    return
  }

  await applyProfilePatch(
    supabase,
    profile,
    {
      subscription_tier: 'pro',
      stripe_customer_id: customerId ?? undefined,
      stripe_subscription_id: subscription.id,
      subscription_current_period_end: unixSecondsToIso(subscription.items.data[0]?.current_period_end),
      subscription_grace_until: null,
    },
    'customer.subscription.resumed'
  )
}

async function handleInvoicePaid(
  supabase: ReturnType<typeof createSecretClient>,
  invoice: Stripe.Invoice
) {
  const customerId = toStripeId(invoice.customer)
  const subscriptionId = typeof ((invoice as any).subscription ?? invoice.parent?.subscription_details?.subscription) === "string" ? ((invoice as any).subscription ?? invoice.parent?.subscription_details?.subscription) : ((invoice as any).subscription ?? invoice.parent?.subscription_details?.subscription)?.id ?? null
  const profile = await resolveProfile(supabase, customerId, subscriptionId)

  if (!profile) {
    console.log('[stripe webhook] invoice.paid no matching profile', {
      customerId,
      subscriptionId,
    })
    return
  }

  let periodEnd = getInvoicePeriodEnd(invoice)
  if (!periodEnd && subscriptionId) {
    periodEnd = await getSubscriptionPeriodEnd(subscriptionId)
  }

  await applyProfilePatch(
    supabase,
    profile,
    {
      subscription_tier: 'pro',
      stripe_customer_id: customerId ?? undefined,
      stripe_subscription_id: subscriptionId ?? undefined,
      subscription_current_period_end: periodEnd ?? undefined,
      subscription_grace_until: null,
    },
    'invoice.paid'
  )
}

async function handleInvoicePaymentFailed(
  supabase: ReturnType<typeof createSecretClient>,
  invoice: Stripe.Invoice,
  eventCreated: number
) {
  const customerId = toStripeId(invoice.customer)
  const subscriptionId = typeof ((invoice as any).subscription ?? invoice.parent?.subscription_details?.subscription) === "string" ? ((invoice as any).subscription ?? invoice.parent?.subscription_details?.subscription) : ((invoice as any).subscription ?? invoice.parent?.subscription_details?.subscription)?.id ?? null
  const profile = await resolveProfile(supabase, customerId, subscriptionId)

  if (!profile) {
    console.log('[stripe webhook] invoice.payment_failed no matching profile', {
      customerId,
      subscriptionId,
    })
    return
  }

  await applyProfilePatch(
    supabase,
    profile,
    {
      subscription_tier: 'grace',
      stripe_customer_id: customerId ?? undefined,
      stripe_subscription_id: subscriptionId ?? undefined,
      subscription_grace_until: graceUntilFromEventCreated(eventCreated),
    },
    'invoice.payment_failed'
  )
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe webhook] missing STRIPE_WEBHOOK_SECRET')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe webhook] signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createSecretClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      await handleCheckoutSessionCompleted(supabase, event.data.object as Stripe.Checkout.Session)
      break
    }
    case 'customer.created': {
      await handleCustomerCreated(supabase, event.data.object as Stripe.Customer)
      break
    }
    case 'customer.updated': {
      await handleCustomerUpdated(
        supabase,
        event.data.object as Stripe.Customer | Stripe.DeletedCustomer
      )
      break
    }
    case 'customer.subscription.created': {
      await handleSubscriptionCreated(supabase, event.data.object as Stripe.Subscription)
      break
    }
    case 'customer.subscription.updated': {
      await handleSubscriptionUpdated(supabase, event.data.object as Stripe.Subscription)
      break
    }
    case 'customer.subscription.deleted': {
      await handleSubscriptionDeleted(supabase, event.data.object as Stripe.Subscription)
      break
    }
    case 'customer.subscription.paused': {
      await handleSubscriptionPaused(supabase, event.data.object as Stripe.Subscription)
      break
    }
    case 'customer.subscription.resumed': {
      await handleSubscriptionResumed(supabase, event.data.object as Stripe.Subscription)
      break
    }
    case 'customer.subscription.trial_will_end': {
      console.log('[stripe webhook] customer.subscription.trial_will_end', {
        id: (event.data.object as Stripe.Subscription).id,
      })
      break
    }
    case 'invoice.created': {
      console.log('[stripe webhook] invoice.created', { id: (event.data.object as Stripe.Invoice).id })
      break
    }
    case 'invoice.finalized': {
      console.log('[stripe webhook] invoice.finalized', { id: (event.data.object as Stripe.Invoice).id })
      break
    }
    case 'invoice.paid': {
      await handleInvoicePaid(supabase, event.data.object as Stripe.Invoice)
      break
    }
    case 'invoice.payment_failed': {
      await handleInvoicePaymentFailed(supabase, event.data.object as Stripe.Invoice, event.created)
      break
    }
    case 'invoice.payment_action_required': {
      console.log('[stripe webhook] invoice.payment_action_required', {
        id: (event.data.object as Stripe.Invoice).id,
      })
      break
    }
    default: {
      console.log(`[stripe webhook] unhandled event: ${event.type}`)
    }
  }

  return NextResponse.json({ received: true })
}
