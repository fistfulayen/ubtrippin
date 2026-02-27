'use client'

import Link from 'next/link'
import { useMemo } from 'react'

import { EARLY_ADOPTER_LIMIT, PRICE_EARLY_ADOPTER } from '@/lib/billing'
import { useEarlyAdopterSpots } from '@/hooks/use-early-adopter-spots'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface UpgradeCardProps {
  title: string
  description: string
  variant?: 'inline' | 'card' | 'banner'
  showEarlyAdopter?: boolean
  className?: string
}

function EarlyAdopterBadge({ spotsRemaining }: { spotsRemaining: number }) {
  const claimedPercent = useMemo(() => {
    const claimed = Math.max(0, EARLY_ADOPTER_LIMIT - spotsRemaining)
    return Math.min(100, Math.round((claimed / EARLY_ADOPTER_LIMIT) * 100))
  }, [spotsRemaining])

  if (spotsRemaining <= 0) {
    return (
      <div className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
        Early adopter pricing sold out
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <p className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        🎉 Early adopter: {PRICE_EARLY_ADOPTER} ({spotsRemaining} spots left)
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-indigo-100">
        <div
          className="h-full rounded-full bg-indigo-600 transition-all"
          style={{ width: `${claimedPercent}%` }}
        />
      </div>
    </div>
  )
}

export function UpgradeCard({
  title,
  description,
  variant = 'card',
  showEarlyAdopter = false,
  className,
}: UpgradeCardProps) {
  const spotsRemaining = useEarlyAdopterSpots(showEarlyAdopter)

  const badge = showEarlyAdopter && spotsRemaining !== null
    ? <EarlyAdopterBadge spotsRemaining={spotsRemaining} />
    : null

  if (variant === 'inline') {
    return (
      <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-sm', className)}>
        <span className="font-medium text-slate-900">{title}</span>
        <span className="text-slate-600">{description}</span>
        <Link
          href="/settings/billing"
          className="font-medium text-indigo-600 transition-colors hover:text-indigo-500"
        >
          Upgrade →
        </Link>
        {badge}
      </div>
    )
  }

  if (variant === 'banner') {
    return (
      <div className={cn('w-full', className)}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-semibold text-slate-900">{title}</span>
            <span className="text-slate-600">{description}</span>
          </div>
          <Link href="/settings/billing" className="shrink-0">
            <Button
              size="sm"
              className="bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500"
            >
              Upgrade →
            </Button>
          </Link>
        </div>
        {badge && <div className="mt-2">{badge}</div>}
      </div>
    )
  }

  return (
    <Card className={cn('rounded-lg border-slate-200 bg-white shadow-none', className)}>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">{description}</p>
          {badge}
        </div>
        <Link href="/settings/billing" className="shrink-0">
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500">
            Upgrade →
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
