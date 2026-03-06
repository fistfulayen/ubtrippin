'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'

interface ShareTripButtonProps {
  shareUrl: string
}

export function ShareTripButton({ shareUrl }: ShareTripButtonProps) {
  const [copied, setCopied] = useState(false)
  const [showToast, setShowToast] = useState(false)

  const handleShare = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setShowToast(true)
      setTimeout(() => {
        setCopied(false)
        setShowToast(false)
      }, 1800)
    } catch {
      setCopied(false)
      setShowToast(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex items-center gap-1 rounded-lg border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-medium text-[#1e293b] transition-colors hover:border-[#4338ca] hover:text-[#4338ca]"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
        Share this trip
      </button>

      {showToast && (
        <div className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#1e293b] px-4 py-2 text-xs font-medium text-white shadow-lg">
          Share link copied
        </div>
      )}
    </>
  )
}
