'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export function InboxHighlightScroll() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const highlightId = searchParams.get('highlight')
    if (!highlightId) return

    const el = document.querySelector<HTMLElement>(`[data-email-id="${CSS.escape(highlightId)}"]`)
    if (!el) return

    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [searchParams])

  return null
}
