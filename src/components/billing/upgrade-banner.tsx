'use client'

import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { UpgradeCard } from '@/components/billing/upgrade-card'

const DISMISS_KEY = 'upgrade-banner-dismissed'
const REAPPEAR_MS = 7 * 24 * 60 * 60 * 1000

interface UpgradeBannerProps {
  subscriptionTier?: string | null
}

interface BillingSubscriptionPayload {
  earlyAdopterSpotsRemaining?: number
}

export function UpgradeBanner({ subscriptionTier }: UpgradeBannerProps) {
  const [ready, setReady] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [spotsRemaining, setSpotsRemaining] = useState<number | null>(null)

  const isFree = useMemo(() => (subscriptionTier ?? 'free') === 'free', [subscriptionTier])

  useEffect(() => {
    if (!isFree) {
      setReady(true)
      return
    }

    try {
      const raw = window.localStorage.getItem(DISMISS_KEY)
      if (!raw) {
        setDismissed(false)
      } else {
        const dismissedAt = Number.parseInt(raw, 10)
        const stillDismissed = Number.isFinite(dismissedAt) && Date.now() - dismissedAt < REAPPEAR_MS

        if (stillDismissed) {
          setDismissed(true)
        } else {
          window.localStorage.removeItem(DISMISS_KEY)
          setDismissed(false)
        }
      }
    } catch {
      setDismissed(false)
    } finally {
      setReady(true)
    }
  }, [isFree])

  useEffect(() => {
    if (!isFree || dismissed) {
      return
    }

    let active = true

    async function loadSpots() {
      try {
        const response = await fetch('/api/v1/billing/subscription', {
          cache: 'no-store',
        })
        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as BillingSubscriptionPayload
        const nextSpots = payload.earlyAdopterSpotsRemaining
        if (active && typeof nextSpots === 'number') {
          setSpotsRemaining(nextSpots)
        }
      } catch {
        // Ignore fetch failures; fallback copy still renders.
      }
    }

    loadSpots()
    return () => {
      active = false
    }
  }, [dismissed, isFree])

  if (!ready || !isFree || dismissed) {
    return null
  }

  const earlyAdopterAvailable = spotsRemaining === null || spotsRemaining > 0
  const title = earlyAdopterAvailable
    ? '🎉 Early adopter pricing: $10/year for unlimited everything.'
    : 'Upgrade to Pro - $2.99/month'
  const description = earlyAdopterAvailable
    ? `Only ${spotsRemaining ?? '...'} spots left.`
    : ''

  const dismissBanner = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // Ignore localStorage failures.
    }
  }

  return (
    <div className="border-b border-slate-200 bg-white/90">
      <div className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2 sm:px-6 lg:px-8">
        <UpgradeCard
          title={title}
          description={description}
          variant="banner"
          className="flex-1"
        />
        <button
          type="button"
          onClick={dismissBanner}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Dismiss upgrade banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
