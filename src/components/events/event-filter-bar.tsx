'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { EventSegment } from '@/types/events'

export function buildSegmentHref(
  pathname: string,
  currentParams: URLSearchParams,
  segmentKey?: string
): string {
  const params = new URLSearchParams(currentParams.toString())
  if (!segmentKey) {
    params.delete('segment')
  } else {
    params.set('segment', segmentKey)
  }
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function EventFilterBar({
  segments,
  activeSegment,
}: {
  segments: EventSegment[]
  activeSegment?: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <div className="sticky top-0 z-20 -mx-4 overflow-x-auto border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:mx-0 sm:overflow-visible sm:px-0">
      <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
        <Link
          href={buildSegmentHref(pathname, searchParams, undefined)}
          className={cn(
            'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
            !activeSegment
              ? 'border-slate-950 bg-slate-950 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
          )}
        >
          All Events
        </Link>
        {segments.map((segment) => (
          <Link
            key={segment.key}
            href={buildSegmentHref(pathname, searchParams, segment.key)}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
              activeSegment === segment.key
                ? 'border-slate-950 bg-slate-950 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            )}
          >
            {segment.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
