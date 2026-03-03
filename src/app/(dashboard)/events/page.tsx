import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Ticket, MapPin, Clock, CalendarDays } from 'lucide-react'
import { formatDate } from '@/lib/utils'

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
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
          <Ticket className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-sm text-gray-500">Concerts, shows, sports — all your tickets</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
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
