'use client'

import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

import { UpgradeCard } from '@/components/billing/upgrade-card'
import { useEarlyAdopterSpots } from '@/hooks/use-early-adopter-spots'
import { PRICE_EARLY_ADOPTER, PRICE_PRO_MONTHLY } from '@/lib/billing'

const DISMISS_KEY = 'upgrade-banner-dismissed'
const DISMISS_COUNT_KEY = 'upgrade-banner-dismiss-count'
const REAPPEAR_MS = 7 * 24 * 60 * 60 * 1000
const MAX_DISMISSALS = 3

interface UpgradeBannerProps {
  subscriptionTier?: string | null
}

export function UpgradeBanner({ subscriptionTier }: UpgradeBannerProps) {
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const isFree = useMemo(() => (subscriptionTier ?? 'free') === 'free', [subscriptionTier])
  const spotsRemaining = useEarlyAdopterSpots(isFree && !dismissed)

  useEffect(() => {
    if (!isFree) {
      setReady(true)
      return
    }

    try {
      const dismissCountRaw = window.localStorage.getItem(DISMISS_COUNT_KEY)
      const dismissCount = Number.parseInt(dismissCountRaw ?? '0', 10)
      if (Number.isFinite(dismissCount) && dismissCount >= MAX_DISMISSALS) {
        setDismissed(true)
        return
      }

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

  if (!ready || !isFree || dismissed || pathname?.startsWith('/settings/billing')) {
    return null
  }

  const earlyAdopterAvailable = spotsRemaining === null || spotsRemaining > 0
  const title = earlyAdopterAvailable
    ? `🎉 Early adopter pricing: ${PRICE_EARLY_ADOPTER} for unlimited everything.`
    : `Upgrade to Pro — ${PRICE_PRO_MONTHLY}`
  const description = earlyAdopterAvailable
    ? `Only ${spotsRemaining ?? '...'} spots left.`
    : ''

  const dismissBanner = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
      const dismissCountRaw = window.localStorage.getItem(DISMISS_COUNT_KEY)
      const dismissCount = Number.parseInt(dismissCountRaw ?? '0', 10)
      const nextDismissCount = Number.isFinite(dismissCount) ? dismissCount + 1 : 1
      window.localStorage.setItem(DISMISS_COUNT_KEY, String(nextDismissCount))
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
