import Link from 'next/link'
import { CalendarDays, Church, ExternalLink, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatDateRange } from '@/lib/utils'
import type { CityEvent } from '@/types/events'

export function getEventCardClasses(event: Pick<CityEvent, 'event_tier' | 'venue_type'>): string {
  const sacred = event.venue_type === 'sacred_venue'
  if (event.event_tier === 'major') {
    return sacred
      ? 'border-indigo-200 bg-linear-to-br from-indigo-50 to-white'
      : 'border-slate-200 bg-white'
  }
  if (event.event_tier === 'medium') {
    return sacred
      ? 'border-indigo-200 bg-indigo-50/40'
      : 'border-slate-200 bg-slate-50/70'
  }
  return sacred ? 'border-indigo-100 bg-white' : 'border-slate-200 bg-white'
}

function headingClasses(event: Pick<CityEvent, 'event_tier' | 'venue_type'>): string {
  return cn(
    'text-slate-950',
    event.event_tier === 'major' || event.venue_type === 'sacred_venue'
      ? 'font-serif text-2xl'
      : event.event_tier === 'medium'
        ? 'text-lg font-semibold'
        : 'text-base font-semibold'
  )
}

export function EventCard({
  event,
  href,
}: {
  event: CityEvent
  href?: string
}) {
  const isMajor = event.event_tier === 'major'
  const isLocal = event.event_tier === 'local'
  const sacred = event.venue_type === 'sacred_venue'
  const detailHref = href ?? event.source_url ?? event.booking_url ?? undefined
  const detailIsExternal = Boolean(detailHref?.startsWith('http'))
  const body = (
    <Card className={cn('overflow-hidden rounded-2xl shadow-sm', getEventCardClasses(event))}>
      {isMajor && event.image_url ? (
        <div className="relative h-56 w-full overflow-hidden bg-slate-100">
          <img src={event.image_url} alt={event.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent" />
          <div className="absolute left-4 top-4">
            <Badge className="rounded-full bg-white/90 text-slate-900">Featured</Badge>
          </div>
        </div>
      ) : null}
      <CardContent className={cn('p-4', isLocal ? 'space-y-3' : 'space-y-4')}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn(sacred && 'border-indigo-300 text-indigo-700')}>
            {event.category}
          </Badge>
          {!isMajor ? <Badge variant="secondary">{event.event_tier}</Badge> : null}
          {sacred ? (
            <Badge variant="outline" className="border-indigo-300 text-indigo-700">
              <Church className="mr-1 h-3 w-3" />
              Sacred Venue
            </Badge>
          ) : null}
        </div>

        <div className={cn(!isLocal && 'grid gap-3 md:grid-cols-[1fr_auto] md:items-start')}>
          <div className="space-y-2">
            <h3 className={headingClasses(event)}>{event.title}</h3>
            {event.description ? (
              <p className="line-clamp-3 text-sm text-slate-600">{event.description}</p>
            ) : null}
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                {formatDateRange(event.start_date, event.end_date)}
                {event.time_info ? ` • ${event.time_info}` : ''}
              </span>
              {event.venue_name ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {event.venue_name}
                </span>
              ) : null}
            </div>
          </div>

          {!isLocal ? (
            <div className="flex shrink-0 gap-2 md:flex-col">
              {detailHref ? (
                detailIsExternal ? (
                  <a
                    href={detailHref}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                  >
                    View Details
                  </a>
                ) : (
                  <Link
                    href={detailHref}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                  >
                    View Details
                  </Link>
                )
              ) : null}
              {event.booking_url ? (
                <a
                  href={event.booking_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex h-10 items-center justify-center rounded-xl border-2 border-gray-200 px-4 text-sm font-medium transition-colors hover:bg-gray-50"
                >
                  Tickets
                  <ExternalLink className="ml-1 h-4 w-4" />
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        {event.lineup?.length ? (
          <div className="flex flex-wrap gap-2">
            {event.lineup.slice(0, 6).map((artist) => (
              <span
                key={`${event.id}-${artist.name}`}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                {artist.name}
              </span>
            ))}
          </div>
        ) : null}

        {event.children?.length ? (
          <div className="flex flex-wrap gap-2">
            {event.children.slice(0, 6).map((child) => (
              <span
                key={child.id}
                className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
              >
                {child.title}
              </span>
            ))}
          </div>
        ) : null}

        {isLocal ? (
          <div className="flex gap-2">
            {detailHref ? (
              detailIsExternal ? (
                <a
                  href={detailHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex h-8 items-center justify-center rounded-xl bg-slate-950 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                >
                  View Details
                </a>
              ) : (
                <Link
                  href={detailHref}
                  className="inline-flex h-8 items-center justify-center rounded-xl bg-slate-950 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                >
                  View Details
                </Link>
              )
            ) : null}
            {event.booking_url ? (
              <a
                href={event.booking_url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-8 items-center justify-center rounded-xl border-2 border-gray-200 px-3 text-sm font-medium transition-colors hover:bg-gray-50"
              >
                Tickets
              </a>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )

  return href && !isLocal ? <div>{body}</div> : body
}
