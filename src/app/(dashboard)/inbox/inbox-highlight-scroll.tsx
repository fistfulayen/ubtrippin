'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export function InboxHighlightScroll() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const highlightId = searchParams.get('highlight')
    if (!highlightId) return

    // Wait for hydration + DOM paint
    const timer = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-email-id="${CSS.escape(highlightId)}"]`)
      if (!el) return

      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Add a pulse effect
      el.classList.add('ring-2', 'ring-indigo-400', 'shadow-lg')
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-indigo-400', 'shadow-lg')
      }, 3000)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchParams])

  return null
}
