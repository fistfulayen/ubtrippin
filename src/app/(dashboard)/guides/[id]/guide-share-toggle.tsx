'use client'

import { useState } from 'react'
import { Globe, Lock, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toggleGuidePublic } from '../actions'

interface Props {
  guideId: string
  isPublic: boolean
  shareUrl: string | null
}

export function GuideShareToggle({ guideId, isPublic, shareUrl }: Props) {
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleToggle = async () => {
    setPending(true)
    await toggleGuidePublic(guideId, !isPublic)
    setPending(false)
    // Page revalidates via server action
    window.location.reload()
  }

  const handleCopy = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={pending}
      >
        {isPublic ? (
          <>
            <Globe className="h-3.5 w-3.5 mr-1.5 text-green-600" />
            <span className="text-green-700">Public</span>
          </>
        ) : (
          <>
            <Lock className="h-3.5 w-3.5 mr-1.5" />
            Private
          </>
        )}
      </Button>

      {isPublic && shareUrl && (
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copy link
            </>
          )}
        </Button>
      )}
    </div>
  )
}
