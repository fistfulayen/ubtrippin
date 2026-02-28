'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Sparkles } from 'lucide-react'

const SHOWN_KEY = 'upgrade-success-shown'

interface UpgradeSuccessProps {
  active: boolean
}

const UNLOCKED_FEATURES = [
  'Unlimited active trips',
  'Unlimited monthly extractions',
  'Unlimited loyalty programs',
  'PDF export from trips',
  'Webhook registrations',
  'Live calendar feed',
]

export function UpgradeSuccess({ active }: UpgradeSuccessProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) return

    try {
      const alreadyShown = window.localStorage.getItem(SHOWN_KEY) === '1'
      if (alreadyShown) return
      window.localStorage.setItem(SHOWN_KEY, '1')
      setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    const query = new URLSearchParams(searchParams.toString())
    query.delete('upgraded')
    const nextUrl = query.size > 0 ? `${pathname}?${query.toString()}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [active, pathname, router, searchParams])

  useEffect(() => {
    if (!visible) return

    import('canvas-confetti').then((confettiModule) => {
      const confetti = confettiModule.default

      confetti({
        particleCount: 120,
        spread: 75,
        origin: { x: 0.5, y: 0.45 },
        colors: ['#4f46e5', '#0f172a', '#f59e0b', '#ffffff'],
      })

      setTimeout(() => {
        confetti({
          particleCount: 55,
          angle: 60,
          spread: 50,
          origin: { x: 0, y: 0.6 },
          colors: ['#4f46e5', '#f59e0b'],
        })
      }, 220)

      setTimeout(() => {
        confetti({
          particleCount: 55,
          angle: 120,
          spread: 50,
          origin: { x: 1, y: 0.6 },
          colors: ['#0f172a', '#4f46e5'],
        })
      }, 320)
    })
  }, [visible])

  if (!visible) return null

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
      <p className="flex items-center gap-2 text-base font-semibold text-green-800">
        <Sparkles className="h-4 w-4" />
        Welcome to Pro! Here&apos;s what you just unlocked:
      </p>
      <ul className="mt-3 space-y-1 text-sm text-green-700">
        {UNLOCKED_FEATURES.map((feature) => (
          <li key={feature}>- {feature}</li>
        ))}
      </ul>
    </div>
  )
}
