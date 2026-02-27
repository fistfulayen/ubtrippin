'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, CreditCard, PauseCircle } from 'lucide-react'

import { EarlyAdopterCounter } from '@/components/billing/early-adopter-counter'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type SubscriptionTier = 'free' | 'pro' | 'grace' | 'paused'
type StripeInterval = 'day' | 'week' | 'month' | 'year' | null

interface SubscriptionPrice {
  id: string
  amount: number | null
  currency: string
  interval: StripeInterval
}

interface BillingSubscriptionResponse {
  subscription_tier: SubscriptionTier
  subscription_current_period_end: string | null
  subscription_grace_until: string | null
  earlyAdopterSpotsRemaining: number
  current_price: SubscriptionPrice | null
}

interface BillingPrice {
  id: string
  name: string
  amount: number | null
  currency: string
  interval: StripeInterval
  available?: boolean
  spotsRemaining?: number
}

interface BillingPricesResponse {
  prices: BillingPrice[]
}

interface BillingPanelProps {
  initialSubscription: BillingSubscriptionResponse
}

function parseApiError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback
  const error = (payload as { error?: { message?: string } }).error
  return error?.message || fallback
}

function formatDate(value: string | null): string {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'N/A'
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatMoney(amount: number | null, currency: string): string {
  if (typeof amount !== 'number') return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100)
}

function formatPlanSuffix(price: SubscriptionPrice | null): string {
  if (!price) return '$24.99/year'
  const base = formatMoney(price.amount, price.currency)
  if (!price.interval) return base
  return `${base}/${price.interval}`
}

function formatCheckoutLabel(price: BillingPrice | null, fallback: string): string {
  if (!price) return fallback
  const base = formatMoney(price.amount, price.currency)
  if (!price.interval) return base
  return `${base}/${price.interval}`
}

export function BillingPanel({ initialSubscription }: BillingPanelProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [subscription, setSubscription] = useState<BillingSubscriptionResponse>(initialSubscription)
  const [prices, setPrices] = useState<BillingPrice[]>([])
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUpgradeToast, setShowUpgradeToast] = useState(false)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [subscriptionRes, pricesRes] = await Promise.all([
          fetch('/api/v1/billing/subscription', { cache: 'no-store' }),
          fetch('/api/v1/billing/prices', { cache: 'no-store' }),
        ])

        if (subscriptionRes.ok) {
          const subscriptionPayload = (await subscriptionRes.json()) as BillingSubscriptionResponse
          if (active) {
            setSubscription(subscriptionPayload)
          }
        }

        if (pricesRes.ok) {
          const pricesPayload = (await pricesRes.json()) as BillingPricesResponse
          if (active) {
            setPrices(pricesPayload.prices ?? [])
          }
        }
      } catch {
        // Keep initial server-rendered state on fetch failures.
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (searchParams.get('upgraded') !== 'true') {
      return
    }

    setShowUpgradeToast(true)

    import('canvas-confetti').then((confettiModule) => {
      const confetti = confettiModule.default

      confetti({
        particleCount: 110,
        spread: 70,
        origin: { x: 0.5, y: 0.5 },
        colors: ['#4f46e5', '#0f172a', '#f59e0b', '#ffffff'],
      })

      setTimeout(() => {
        confetti({
          particleCount: 45,
          angle: 60,
          spread: 50,
          origin: { x: 0, y: 0.6 },
          colors: ['#4f46e5', '#f59e0b'],
        })
      }, 220)

      setTimeout(() => {
        confetti({
          particleCount: 45,
          angle: 120,
          spread: 50,
          origin: { x: 1, y: 0.6 },
          colors: ['#0f172a', '#4f46e5'],
        })
      }, 320)
    })

    const query = new URLSearchParams(searchParams.toString())
    query.delete('upgraded')
    const nextUrl = query.size > 0 ? `${pathname}?${query.toString()}` : pathname
    router.replace(nextUrl, { scroll: false })

    const timer = setTimeout(() => {
      setShowUpgradeToast(false)
    }, 4500)

    return () => clearTimeout(timer)
  }, [pathname, router, searchParams])

  const earlyPrice = useMemo(
    () => prices.find((price) => typeof price.available === 'boolean') ?? null,
    [prices]
  )
  const monthlyPrice = useMemo(
    () => prices.find((price) => price.interval === 'month') ?? null,
    [prices]
  )
  const annualPrice = useMemo(
    () => prices.find((price) => price.interval === 'year' && price.id !== earlyPrice?.id) ?? null,
    [prices, earlyPrice?.id]
  )
  const earlyAdopterAvailable = (earlyPrice?.available ?? false) && (earlyPrice?.spotsRemaining ?? 0) > 0

  const startCheckout = async (priceId: string) => {
    setLoadingPriceId(priceId)
    setError(null)

    try {
      const response = await fetch('/api/v1/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setError(parseApiError(payload, 'Unable to start checkout.'))
        return
      }

      const url = (payload as { url?: string } | null)?.url
      if (!url) {
        setError('Stripe checkout URL was not returned.')
        return
      }

      window.location.href = url
    } catch {
      setError('Unable to start checkout right now.')
    } finally {
      setLoadingPriceId(null)
    }
  }

  const openPortal = async () => {
    setPortalLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/v1/billing/portal', {
        method: 'GET',
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setError(parseApiError(payload, 'Unable to open billing portal.'))
        return
      }

      const url = (payload as { url?: string } | null)?.url
      if (!url) {
        setError('Billing portal URL was not returned.')
        return
      }

      window.location.href = url
    } catch {
      setError('Unable to open billing portal right now.')
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {showUpgradeToast && (
        <div className="fixed right-4 top-20 z-50 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 shadow-md">
          Welcome to Pro! All limits have been removed.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {subscription.subscription_tier === 'free' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Plan: Free
            </CardTitle>
            <CardDescription>3 active trips · 10 extractions/month · 3 loyalty programs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-[#cbd5e1] bg-[#f8fafc] p-4">
              <h3 className="text-base font-semibold text-[#1e293b]">Upgrade to Pro</h3>
              <p className="mt-2 text-sm text-[#1e293b]">
                Unlimited trips, loyalty vault, train status, family creation, API access, webhooks, and
                everything we build.
              </p>

              {earlyAdopterAvailable && (
                <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-900">
                    🎉 Early adopter: {formatCheckoutLabel(earlyPrice, '$10/year')} ({earlyPrice?.spotsRemaining ?? 0} spots remaining)
                  </p>
                  <p className="text-xs font-medium tracking-wide text-amber-700">or</p>
                  <p className="text-sm text-[#1e293b]">
                    {formatCheckoutLabel(monthlyPrice, '$2.99/month')} · {formatCheckoutLabel(annualPrice, '$24.99/year')}
                  </p>
                  <Button
                    onClick={() => earlyPrice?.id && startCheckout(earlyPrice.id)}
                    disabled={!earlyPrice?.id || loadingPriceId !== null}
                    className="w-full sm:w-auto"
                  >
                    {loadingPriceId === earlyPrice?.id
                      ? 'Redirecting...'
                      : `Get Early Adopter → ${formatCheckoutLabel(earlyPrice, '$10/year')}`}
                  </Button>
                </div>
              )}

              {!earlyAdopterAvailable && (
                <p className="mt-4 text-sm text-[#1e293b]">
                  {formatCheckoutLabel(monthlyPrice, '$2.99/month')} · {formatCheckoutLabel(annualPrice, '$24.99/year')}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant={earlyAdopterAvailable ? 'outline' : 'primary'}
                  onClick={() => monthlyPrice?.id && startCheckout(monthlyPrice.id)}
                  disabled={!monthlyPrice?.id || loadingPriceId !== null}
                >
                  {loadingPriceId === monthlyPrice?.id
                    ? 'Redirecting...'
                    : `Go Monthly → ${formatCheckoutLabel(monthlyPrice, '$2.99/month')}`}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => annualPrice?.id && startCheckout(annualPrice.id)}
                  disabled={!annualPrice?.id || loadingPriceId !== null}
                >
                  {loadingPriceId === annualPrice?.id
                    ? 'Redirecting...'
                    : `Go Annual → ${formatCheckoutLabel(annualPrice, '$24.99/year')}`}
                </Button>
              </div>
            </div>

            <EarlyAdopterCounter />
          </CardContent>
        </Card>
      )}

      {subscription.subscription_tier === 'pro' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Plan: Pro ({formatPlanSuffix(subscription.current_price)})
            </CardTitle>
            <CardDescription>Next billing: {formatDate(subscription.subscription_current_period_end)}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openPortal} disabled={portalLoading}>
              {portalLoading ? 'Opening...' : 'Manage Billing →'}
            </Button>
          </CardContent>
        </Card>
      )}

      {subscription.subscription_tier === 'grace' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              Payment Failed
            </CardTitle>
            <CardDescription>
              Your payment method was declined. You have Pro access until {formatDate(subscription.subscription_grace_until)}.
              Update your payment method to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openPortal} disabled={portalLoading}>
              {portalLoading ? 'Opening...' : 'Update Payment Method →'}
            </Button>
          </CardContent>
        </Card>
      )}

      {subscription.subscription_tier === 'paused' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PauseCircle className="h-5 w-5" />
              Your subscription is paused.
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={openPortal} disabled={portalLoading}>
              {portalLoading ? 'Opening...' : 'Resume Subscription →'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
