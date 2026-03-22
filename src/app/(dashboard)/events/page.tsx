import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Ticket, MapPin, Clock, CalendarDays, Sparkles } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { getTrackedCities, getCityEvents, matchTrackedCityByName } from '@/lib/events/queries'
import type { CityEvent, TrackedCity } from '@/types/events'
import { HomeCityPrompt } from './HomeCityPrompt'

interface TicketItem {
  id: string
  trip_id: string
  kind: string
  provider: string | null
  start_date: string | null
  start_ts: string | null
  start_location: string | null
  summary: string | null
  details_json: Record<string, unknown> | null
  trips: {
    id: string
    title: string
    cover_image_url: string | null
  } | null
}

type EventFilter = 'upcoming' | 'past' | 'all'

interface HeroData {
  city: TrackedCity
  events: CityEvent[]
}

async function resolveCurrentCity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  today: string
): Promise<{ city: TrackedCity; events: CityEvent[] } | null> {
  const cities = await getTrackedCities(supabase)

  // Check for active trip
  const { data: activeTrips } = await supabase
    .from('trips')
    .select('primary_location')
    .eq('user_id', userId)
    .lte('start_date', today)
    .gte('end_date', today)
    .not('primary_location', 'is', null)
    .limit(1)

  let cityName: string | null = null

  if (activeTrips && activeTrips.length > 0) {
    cityName = activeTrips[0].primary_location as string
  } else {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('home_city')
      .eq('id', userId)
      .maybeSingle()
    cityName = profile?.home_city ?? null
  }

  if (!cityName) return null

  const trackedCity = matchTrackedCityByName(cities, cityName)
  if (!trackedCity) return null

  const twoWeeksOut = new Date(today)
  twoWeeksOut.setDate(twoWeeksOut.getDate() + 14)
  const toDate = twoWeeksOut.toISOString().slice(0, 10)

  const events = await getCityEvents(supabase, trackedCity.id, { from: today, to: toDate })

  return { city: trackedCity, events }
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const filter = (params.filter as EventFilter) || 'upcoming'
  const today = new Date().toISOString().split('T')[0]

  // Resolve "what's happening" hero city and events
  let heroData: HeroData | null = null
  let hasHomeCity = false

  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('home_city')
      .eq('id', user.id)
      .maybeSingle()
    hasHomeCity = !!(profile?.home_city)
    heroData = await resolveCurrentCity(supabase, user.id, today)
  } catch {
    // Non-fatal — hero section is best-effort
  }

  // Fetch all ticket items for this user, with their trip info
  let query = supabase
    .from('trip_items')
    .select(`
      id, trip_id, kind, provider, start_date, start_ts, start_location, summary, details_json,
      trips!inner (id, title, cover_image_url)
    `)
    .eq('user_id', user.id)
    .eq('kind', 'ticket')
    .order('start_date', { ascending: filter !== 'past' })

  if (filter === 'upcoming') {
    query = query.gte('start_date', today)
  } else if (filter === 'past') {
    query = query.lt('start_date', today)
  }

  const { data: items } = await query
  const tickets = (items || []) as unknown as TicketItem[]

  const filterTabs: { key: EventFilter; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'all', label: 'All' },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
          <Ticket className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-sm text-gray-500">Concerts, shows, sports — all your tickets</p>
        </div>
      </div>

      {/* What's happening hero */}
      {heroData ? (
        <section>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              What&apos;s happening in {heroData.city.city}
            </h2>
            <Link
              href={`/cities/${heroData.city.slug}`}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              View all →
            </Link>
          </div>

          {heroData.events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 py-8 text-center">
              <p className="text-sm text-slate-500">No upcoming events found for {heroData.city.city}.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {heroData.events.slice(0, 6).map((event) => (
                <div
                  key={event.id}
                  className="overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm"
                >
                  <div className="h-28 bg-slate-100">
                    {event.image_url ? (
                      <img
                        src={event.image_url}
                        alt={event.title}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="line-clamp-2 text-sm font-semibold text-slate-900">{event.title}</p>
                    <p className="text-xs text-slate-500">{formatDate(event.start_date)}</p>
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{event.category}</p>
                    {event.venue_name ? (
                      <p className="flex items-center gap-1 text-xs text-slate-400">
                        <MapPin className="h-3 w-3" />
                        {event.venue_name}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <HomeCityPrompt hasHomeCity={hasHomeCity} />
      )}

      <div className="border-t border-gray-100" />

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {filterTabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/events?filter=${tab.key}`}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Event list */}
      {tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <Ticket className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">
            {filter === 'upcoming' ? 'No upcoming events' : filter === 'past' ? 'No past events' : 'No events yet'}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Forward a ticket confirmation to{' '}
            <span className="font-mono font-medium text-gray-600">trips@ubtrippin.xyz</span>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const details = ticket.details_json || {}
            const eventName = (details.event_name as string) || ticket.summary || 'Untitled Event'
            const venue = details.venue as string | undefined
            const performer = details.performer as string | undefined
            const eventTime = details.event_time as string | undefined
            const doorTime = details.door_time as string | undefined
            const section = details.section as string | undefined
            const row = details.row as string | undefined
            const seat = details.seat as string | undefined
            const hasPdf = !!(details.ticket_pdf_path as string | undefined)
            const tripTitle = ticket.trips?.title

            const timeDisplay = eventTime
              ? doorTime ? `${eventTime} (doors ${doorTime})` : eventTime
              : null

            const seatingDisplay = [
              section && `Sec ${section}`,
              row && `Row ${row}`,
              seat && `Seat ${seat}`,
            ].filter(Boolean).join(' · ')

            return (
              <div
                key={ticket.id}
                className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 hover:border-amber-200 hover:bg-amber-50/30 transition-colors"
              >
                {/* Event image or placeholder */}
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-amber-100">
                  {ticket.trips?.cover_image_url ? (
                    <Image
                      src={ticket.trips.cover_image_url}
                      alt={eventName}
                      fill
                      className="object-cover"
                      sizes="64px"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Ticket className="h-7 w-7 text-amber-400" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900 truncate">{eventName}</p>
                      {performer && performer !== eventName && (
                        <p className="text-sm text-gray-500">{performer}</p>
                      )}
                    </div>
                    {hasPdf && (
                      <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                        PDF
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500">
                    {ticket.start_date && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(ticket.start_date)}
                      </span>
                    )}
                    {timeDisplay && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {timeDisplay}
                      </span>
                    )}
                    {venue && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {venue}
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    {seatingDisplay && (
                      <span className="text-xs text-gray-400">{seatingDisplay}</span>
                    )}
                    {tripTitle && (
                      <Link
                        href={`/trips/${ticket.trip_id}`}
                        className="text-xs text-[#4f46e5] hover:underline"
                      >
                        {tripTitle} →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
