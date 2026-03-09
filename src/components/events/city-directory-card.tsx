import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { flagEmoji } from '@/lib/events/queries'
import { formatDate } from '@/lib/utils'
import type { TrackedCity } from '@/types/events'

export function CityDirectoryCard({
  city,
  isOnTrip = false,
}: {
  city: TrackedCity
  isOnTrip?: boolean
}) {
  return (
    <Link href={`/cities/${city.slug}`} className="group block">
      <Card className="relative min-h-[320px] overflow-hidden rounded-2xl border-slate-200 shadow-sm transition-transform duration-300 group-hover:-translate-y-1">
        <div className="absolute inset-0 bg-slate-200">
          {city.hero_image_url ? (
            <img
              src={city.hero_image_url}
              alt={city.city}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-slate-950/10" />
        </div>

        <div className="relative flex min-h-[320px] flex-col justify-between p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <Badge className="rounded-full bg-white/88 text-slate-900">
              {city.active_event_count ?? 0} events
            </Badge>
            {isOnTrip ? <Badge className="rounded-full bg-indigo-500 text-white">Your Trip</Badge> : null}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-white/75">{city.country}</p>
              <h2 className="font-serif text-3xl">{flagEmoji(city.country_code)} {city.city}</h2>
            </div>

            {city.next_notable_event ? (
              <div className="rounded-2xl border border-white/20 bg-white/14 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Next Notable</p>
                <p className="mt-1 font-semibold">{city.next_notable_event.title}</p>
                <p className="mt-1 text-sm text-white/80">{formatDate(city.next_notable_event.date)}</p>
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    </Link>
  )
}
