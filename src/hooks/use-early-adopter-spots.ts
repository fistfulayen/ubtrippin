'use client'

import { useEffect, useState } from 'react'

interface BillingSubscriptionPayload {
  earlyAdopterSpotsRemaining?: number
}

/**
 * Fetches the number of early-adopter Pro spots remaining.
 * Returns `null` while loading (so callers can show a "..." placeholder),
 * or the number once resolved.
 */
export function useEarlyAdopterSpots(enabled = true): number | null {
  const [spotsRemaining, setSpotsRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!enabled) {
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
        // Silently fail — upsell copy renders fine without the spot count.
      }
    }

    loadSpots()
    return () => {
      active = false
    }
  }, [enabled])

  return spotsRemaining
}
