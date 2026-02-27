'use client'

import { useMemo } from 'react'

const EARLY_ADOPTER_LIMIT = 100

interface EarlyAdopterCounterProps {
  /** Spots remaining, sourced from the parent's already-fetched subscription data. */
  spotsRemaining: number | null
}

export function EarlyAdopterCounter({ spotsRemaining }: EarlyAdopterCounterProps) {
  const taken = useMemo(() => {
    if (spotsRemaining === null) return 0
    return EARLY_ADOPTER_LIMIT - spotsRemaining
  }, [spotsRemaining])

  if (spotsRemaining === null || spotsRemaining <= 0) {
    return null
  }

  const progressPercent = Math.round((taken / EARLY_ADOPTER_LIMIT) * 100)

  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <p>🎉 {spotsRemaining} of 100 early adopter spots remaining</p>
      <div className="h-2 overflow-hidden rounded-full bg-amber-100">
        <div
          className="h-full rounded-full bg-amber-500 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="font-mono text-xs text-amber-800">{taken}/100</p>
    </div>
  )
}
