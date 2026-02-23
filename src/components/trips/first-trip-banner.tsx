'use client'

import { useEffect, useState, useTransition } from 'react'
import { Calendar, Share2, Mail, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { dismissFirstTripBanner } from '@/app/(dashboard)/trips/actions'

interface FirstTripBannerProps {
  tripId: string
  tripTitle: string
}

export function FirstTripBanner({ tripId, tripTitle }: FirstTripBannerProps) {
  const [visible, setVisible] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    // Dynamically import canvas-confetti to avoid SSR issues
    import('canvas-confetti').then((confettiModule) => {
      const confetti = confettiModule.default

      // First burst — centered
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { x: 0.5, y: 0.5 },
        colors: ['#b45309', '#d97706', '#fbbf24', '#1e1b4b', '#4f46e5', '#f5f3ef'],
        startVelocity: 40,
        gravity: 0.9,
      })

      // Second burst after a short delay — left side
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: ['#b45309', '#d97706', '#fbbf24'],
        })
      }, 250)

      // Third burst — right side
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: ['#1e1b4b', '#4f46e5', '#818cf8'],
        })
      }, 400)
    })
  }, [])

  const handleDismiss = () => {
    setVisible(false)
    startTransition(async () => {
      await dismissFirstTripBanner()
    })
  }

  if (!visible) return null

  return (
    <div className="relative rounded-2xl border border-[#b45309]/30 bg-gradient-to-br from-[#fff7ed] via-[#fffbf5] to-[#f5f3ef] p-6 shadow-sm overflow-hidden">
      {/* Decorative background accent */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[#b45309]/5" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-[#1e1b4b]/5" />

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        disabled={isPending}
        className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl" role="img" aria-label="party popper">🎉</span>
          <div>
            <h2 className="text-xl font-bold text-[#1e1b4b]">Your first trip!</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              <span className="font-medium text-[#b45309]">{tripTitle}</span> has been added to UBTRIPPIN.
            </p>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="grid gap-3 sm:grid-cols-3">
        <a
          href={`/trips/${tripId}`}
          className="flex items-start gap-3 rounded-xl bg-white/70 border border-[#c7c2b8]/50 p-3 hover:bg-white hover:border-[#b45309]/30 transition-colors group"
        >
          <div className="flex-shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#b45309]/10 group-hover:bg-[#b45309]/20 transition-colors">
            <Share2 className="h-4 w-4 text-[#b45309]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1e1b4b]">Share it</p>
            <p className="text-xs text-gray-500 mt-0.5">Generate a shareable link for friends &amp; family</p>
          </div>
        </a>

        <a
          href={`/trips/${tripId}`}
          className="flex items-start gap-3 rounded-xl bg-white/70 border border-[#c7c2b8]/50 p-3 hover:bg-white hover:border-[#b45309]/30 transition-colors group"
        >
          <div className="flex-shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#1e1b4b]/10 group-hover:bg-[#1e1b4b]/20 transition-colors">
            <Calendar className="h-4 w-4 text-[#1e1b4b]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1e1b4b]">Export to calendar</p>
            <p className="text-xs text-gray-500 mt-0.5">Add the whole itinerary to Apple/Google Calendar</p>
          </div>
        </a>

        <div className="flex items-start gap-3 rounded-xl bg-white/70 border border-[#c7c2b8]/50 p-3">
          <div className="flex-shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
            <Mail className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1e1b4b]">Keep forwarding</p>
            <p className="text-xs text-gray-500 mt-0.5">Forward more booking confirmations to build your itinerary</p>
          </div>
        </div>
      </div>

      {/* Dismiss link */}
      <div className="mt-4 text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          disabled={isPending}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Got it, dismiss
        </Button>
      </div>
    </div>
  )
}
