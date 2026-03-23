'use client'

import { useState } from 'react'

export function ShareButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const url = `https://www.ubtrippin.xyz/dispatches/${slug}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="text-sm uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-[#312e81]"
    >
      {copied ? 'Copied!' : 'Share'}
    </button>
  )
}
