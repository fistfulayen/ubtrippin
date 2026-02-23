'use client'

import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'ubt-pwa-dismiss'

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Already running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsStandalone(true)
      return
    }

    // User already dismissed recently (7 days)
    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10)
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return
    }

    // Only show on mobile devices (screen width < 768px or mobile UA)
    const isMobile =
      window.innerWidth < 768 ||
      /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)
    if (!isMobile) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // For iOS (no beforeinstallprompt), show a manual hint after a delay
    const iosTimer = setTimeout(() => {
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(navigator as any).standalone
      if (isIOS && !deferredPrompt) {
        setVisible(true)
      }
    }, 3000)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      clearTimeout(iosTimer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (isStandalone || !visible) return null

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setVisible(false)
      }
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setVisible(false)
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
  }

  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

  return (
    <div className="relative mx-auto max-w-4xl px-4 mb-4">
      <div className="flex items-center gap-3 rounded-lg border border-[#cbd5e1] bg-[#ffffff] px-4 py-3">
        <Download className="h-5 w-5 shrink-0 text-[#4f46e5]" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#1e293b]">
            Install UB Trippin
          </p>
          <p className="text-xs text-[#4338ca]">
            {isIOS
              ? 'Tap the share button, then "Add to Home Screen"'
              : 'Add to your home screen for quick access to your trips'
            }
          </p>
        </div>
        {!isIOS && deferredPrompt && (
          <Button
            size="sm"
            onClick={handleInstall}
            className="shrink-0 bg-[#1e293b] hover:bg-[#312e81] text-white"
          >
            Install
          </Button>
        )}
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded p-1 text-[#4f46e5] hover:text-[#4f46e5]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
