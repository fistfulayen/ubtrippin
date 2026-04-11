'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { OutgoingShelfData } from '@/types/events'

function buildShelfHref(
  pathname: string,
  currentParams: URLSearchParams,
  shelfSlug?: string
): string {
  const params = new URLSearchParams(currentParams.toString())
  params.delete('segment')
  if (!shelfSlug) {
    params.delete('shelf')
  } else {
    params.set('shelf', shelfSlug)
  }
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function ShelfFilterBar({
  shelves,
  activeShelf,
}: {
  shelves: OutgoingShelfData[]
  activeShelf?: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <div className="sticky top-0 z-20 -mx-4 overflow-x-auto border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:mx-0 sm:overflow-visible sm:px-0">
      <div className="flex min-w-max items-center gap-2 sm:min-w-0 sm:flex-wrap">
        <Link
          href={buildShelfHref(pathname, searchParams, undefined)}
          className={cn(
            'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
            !activeShelf
              ? 'border-slate-950 bg-slate-950 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
          )}
        >
          All
        </Link>
        {shelves.map((shelf) => (
          <Link
            key={shelf.slug}
            href={buildShelfHref(pathname, searchParams, shelf.slug)}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
              activeShelf === shelf.slug
                ? 'border-slate-950 bg-slate-950 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            )}
          >
            {shelf.displayName}
          </Link>
        ))}
      </div>
    </div>
  )
}
