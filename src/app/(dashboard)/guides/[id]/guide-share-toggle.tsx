'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Globe, Lock, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PUBLIC_GUIDE_MIN_ENTRIES, type GuideVisibility } from '@/lib/guides/public'
import { updateGuideVisibility } from '../actions'

interface Props {
  guideId: string
  visibility: GuideVisibility
  shareUrl: string | null
  publicUsername: string | null
  entryCount: number
  showCopyButton?: boolean
}

export function GuideShareToggle({
  guideId,
  visibility,
  shareUrl,
  publicUsername,
  entryCount,
  showCopyButton = true,
}: Props) {
  const router = useRouter()
  const [currentVisibility, setCurrentVisibility] = useState<GuideVisibility>(visibility)
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [helperCode, setHelperCode] = useState<'missing_public_username' | 'not_enough_entries' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleToggle = async (nextVisibility: GuideVisibility) => {
    if (pending || nextVisibility === currentVisibility) {
      return
    }

    setError(null)
    setHelperCode(null)

    if (nextVisibility === 'public' && !publicUsername) {
      setHelperCode('missing_public_username')
      return
    }

    if (nextVisibility === 'public' && entryCount < PUBLIC_GUIDE_MIN_ENTRIES) {
      setHelperCode('not_enough_entries')
      return
    }

    const previousVisibility = currentVisibility
    setCurrentVisibility(nextVisibility)
    setPending(true)
    const result = await updateGuideVisibility(guideId, nextVisibility)
    setPending(false)

    if (!result.ok) {
      setCurrentVisibility(previousVisibility)
      if (result.code === 'missing_public_username' || result.code === 'not_enough_entries') {
        setHelperCode(result.code)
      } else {
        setError(result.error)
      }
      return
    }

    router.refresh()
  }

  const handleCopy = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
          <button
            type="button"
            className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm transition-colors ${
              currentVisibility === 'private'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => handleToggle('private')}
            disabled={pending}
          >
            <Lock className="mr-1.5 h-3.5 w-3.5" />
            Private / Family
          </button>
          <button
            type="button"
            className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm transition-colors ${
              currentVisibility === 'public'
                ? 'bg-emerald-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => handleToggle('public')}
            disabled={pending}
          >
            <Globe className="mr-1.5 h-3.5 w-3.5" />
            Public
          </button>
        </div>

        {showCopyButton && currentVisibility === 'public' && shareUrl && (
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

      {helperCode === 'missing_public_username' ? (
        <p className="text-sm text-amber-700">
          <Link href="/settings/profile" className="underline underline-offset-2">
            Set a public username in Settings
          </Link>{' '}
          to share guides publicly.
        </p>
      ) : null}

      {helperCode === 'not_enough_entries' ? (
        <p className="text-sm text-amber-700">
          Add at least {PUBLIC_GUIDE_MIN_ENTRIES} places to publish this guide (currently {entryCount}).
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}
    </div>
  )
}
