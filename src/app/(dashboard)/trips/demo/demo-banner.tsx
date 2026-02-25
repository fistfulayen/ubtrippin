'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

const EMAIL = 'trips@ubtrippin.xyz'

export function DemoBanner() {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(EMAIL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-yellow-300 bg-yellow-50 px-5 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-yellow-800">
        This is a demo trip. Forward a booking email to{' '}
        <span className="font-mono font-semibold">{EMAIL}</span> to see your real
        data.
      </p>
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0 rounded-lg border border-yellow-400 bg-white px-3 py-1.5 text-sm font-medium text-yellow-800 hover:bg-yellow-50 transition-colors"
        aria-label={`Copy ${EMAIL} to clipboard`}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-green-600" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy address
          </>
        )}
      </button>
    </div>
  )
}
