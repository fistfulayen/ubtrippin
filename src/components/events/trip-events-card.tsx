import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatDateRange } from '@/lib/utils'
import type { CityEvent, TrackedCity } from '@/types/events'

export function TripEventsCard({
  city,
  from,
  to,
  events,
}: {
  city: TrackedCity
  from: string
  to: string
  events: CityEvent[]
}) {
  if (events.length === 0) return null

  return (
    <div className="ml-4 border-l border-indigo-200 pl-6">
      <Card className="rounded-2xl border-indigo-200 bg-indigo-50/50 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">
                <Sparkles className="h-3.5 w-3.5" />
                Curated For Your Dates
              </p>
              <h3 className="mt-1 font-serif text-2xl text-slate-950">What&apos;s on in {city.city}</h3>
              <p className="mt-1 text-sm text-slate-600">{formatDateRange(from, to)}</p>
            </div>
            <Link
              href={`/cities/${city.slug}?from=${from}&to=${to}`}
              className="inline-flex h-10 items-center justify-center rounded-xl border-2 border-indigo-200 bg-white px-4 text-sm font-medium transition-colors hover:bg-indigo-50"
            >
              View What&apos;s On
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {events.slice(0, 3).map((event) => (
              <div key={event.id} className="overflow-hidden rounded-2xl border border-indigo-100 bg-white">
                <div className="h-24 bg-slate-100">
                  {event.image_url ? (
                    <img src={event.image_url} alt={event.title} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 text-sm font-semibold text-slate-950">{event.title}</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{event.category}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
