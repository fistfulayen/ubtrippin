import { Suspense, cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { TripHeader } from '@/components/trips/trip-header'
import { MovementTimeline } from '@/components/trips/movement-timeline'
import { TripActions } from '@/components/trips/trip-actions'
import { CollaboratorsSection } from '@/components/trips/collaborators-section'
import { DemoTripBanner } from '@/components/trips/demo-trip-banner'
import { WeatherSection } from '@/components/trips/weather/weather-section'
import { attachWeatherToTimeline, buildTimeline } from '@/lib/trips/city-segments'
import { getTripTimelineEventPreviews } from '@/lib/events/queries'
import { getTemperatureUnit, getTripWeather } from '@/lib/weather/service'
import type { TemperatureUnit, WeatherResponsePayload } from '@/lib/weather/types'
import type { Trip, TripItem } from '@/types/database'
import { ArrowLeft, Users } from 'lucide-react'
import Link from 'next/link'

interface TripPageProps {
  params: Promise<{ id: string }>
}

type TripListEntry = Pick<Trip, 'id' | 'title' | 'start_date'>
type StreamedTrip = Trip
type StreamedItem = TripItem

const loadTripWeatherForStream = cache(async (params: {
  tripId: string
  userId: string
  requestedUnit: TemperatureUnit
  includePacking: boolean
  trip: StreamedTrip
  items: StreamedItem[]
}) => {
  const supabase = await createClient()

  return getTripWeather({
    tripId: params.tripId,
    supabase,
    userId: params.userId,
    requestedUnit: params.requestedUnit,
    includePacking: params.includePacking,
    prefetchedTrip: params.trip,
    prefetchedItems: params.items,
  })
})

export default async function TripPage({ params }: TripPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [
    {
      data: { user },
    },
    { data: trip, error },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('trips').select('*').eq('id', id).single(),
  ])

  if (error || !trip) {
    notFound()
  }

  const isOwner = trip.user_id === user?.id

  let collabRole: string | null = null
  let inviterName: string | null = null

  if (!isOwner && user) {
    const { data: collab } = await supabase
      .from('trip_collaborators')
      .select('role, inviter:profiles!invited_by (full_name, email)')
      .eq('trip_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (collab) {
      collabRole = collab.role
      const inviterData = collab.inviter as { full_name?: string; email?: string } | null
      inviterName = inviterData?.full_name || inviterData?.email || null
    }
  }

  const [
    { data: items },
    { data: allTrips },
    { data: collaborators },
    { data: profileData },
    userUnit,
  ] = await Promise.all([
    supabase
      .from('trip_items')
      .select('*')
      .eq('trip_id', id)
      .order('start_date', { ascending: true })
      .order('start_ts', { ascending: true }),
    user
      ? supabase
          .from('trips')
          .select('id, title, start_date')
          .order('start_date', { ascending: false })
      : Promise.resolve({ data: null }),
    isOwner
      ? supabase
          .from('trip_collaborators')
          .select('id, user_id, role, invited_email, accepted_at, created_at')
          .eq('trip_id', id)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
    user
      ? supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? getTemperatureUnit(user.id, supabase)
      : Promise.resolve('fahrenheit' as const),
  ])

  const canEdit = isOwner || collabRole === 'editor'
  const isPro = profileData?.subscription_tier === 'pro'
  const tripItems = items ?? []
  const tripOptions = allTrips ?? []

  return (
    <div className="space-y-6">
      <Link
        href="/trips"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to trips
      </Link>

      {!isOwner && inviterName && (
        <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-700">
          <Users className="h-4 w-4 shrink-0" />
          <span>
            Shared by <strong>{inviterName}</strong>
            {collabRole === 'viewer' && ' - view only'}
          </span>
        </div>
      )}

      {trip.is_demo && <DemoTripBanner />}

      <TripHeader trip={trip} />

      {canEdit && (
        <TripActions trip={trip} allTrips={tripOptions} isOwner={isOwner} isPro={isPro} />
      )}

      <CollaboratorsSection
        tripId={id}
        collaborators={collaborators ?? []}
        isOwner={isOwner}
      />

      <Suspense fallback={<TimelineSectionFallback />}>
        <TimelineWithEventsAsync
          trip={trip}
          items={tripItems}
          allTrips={tripOptions}
          currentUserId={user?.id}
          userUnit={userUnit}
          isPro={isPro}
        />
      </Suspense>

      <Suspense fallback={<WeatherSectionFallback />}>
        <WeatherSectionAsync
          trip={trip}
          items={tripItems}
          userId={user?.id}
          userUnit={userUnit}
          isPro={isPro}
        />
      </Suspense>
    </div>
  )
}

interface WeatherSectionAsyncProps {
  trip: StreamedTrip
  items: StreamedItem[]
  userId?: string
  userUnit: TemperatureUnit
  isPro: boolean
}

async function WeatherSectionAsync({
  trip,
  items,
  userId,
  userUnit,
  isPro,
}: WeatherSectionAsyncProps) {
  if (!userId) return null

  const weather = await loadTripWeatherForStream({
    tripId: trip.id,
    userId,
    requestedUnit: userUnit,
    includePacking: isPro,
    trip,
    items,
  })

  return (
    <WeatherSection endpoint={`/api/trips/${trip.id}/weather`} initialData={weather} showPacking />
  )
}

interface TimelineWithEventsAsyncProps {
  trip: StreamedTrip
  items: StreamedItem[]
  allTrips: TripListEntry[]
  currentUserId?: string
  userUnit: TemperatureUnit
  isPro: boolean
  weather?: WeatherResponsePayload | null
}

async function TimelineWithEventsAsync({
  trip,
  items,
  allTrips,
  currentUserId,
  userUnit,
  isPro,
  weather,
}: TimelineWithEventsAsyncProps) {
  const resolvedWeather =
    weather ??
    (currentUserId
      ? await loadTripWeatherForStream({
          tripId: trip.id,
          userId: currentUserId,
          requestedUnit: userUnit,
          includePacking: isPro,
          trip,
          items,
        })
      : null)

  const timeline = attachWeatherToTimeline(buildTimeline(items), resolvedWeather?.destinations ?? [])
  const segmentEntries = timeline
    .filter((entry) => entry.type === 'segment' && entry.segment != null)
    .map((entry) => entry.segment!)
  const segmentEvents = currentUserId
    ? await getTripTimelineEventPreviews(await createClient(), segmentEntries)
    : {}

  return (
    <MovementTimeline
      entries={timeline}
      allTrips={allTrips}
      currentUserId={currentUserId}
      segmentEvents={segmentEvents}
    />
  )
}

function TimelineSectionFallback() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="h-4 w-24 rounded-full bg-gray-200" />
          <div className="mt-4 h-8 w-52 rounded-lg bg-gray-200" />
          <div className="mt-3 flex flex-wrap gap-3">
            <div className="h-4 w-28 rounded-full bg-gray-200" />
            <div className="h-4 w-36 rounded-full bg-gray-200" />
            <div className="h-4 w-20 rounded-full bg-gray-200" />
          </div>
          <div className="mt-5 h-24 rounded-2xl bg-gray-200" />
        </div>
      ))}
    </div>
  )
}

function WeatherSectionFallback() {
  return (
    <section className="space-y-4 rounded-[28px] border border-gray-200 bg-[#f7fbff] p-5 animate-pulse">
      <div className="space-y-2">
        <div className="h-6 w-52 rounded-lg bg-gray-200" />
        <div className="h-4 w-72 rounded-lg bg-gray-200" />
      </div>
      <div className="h-24 rounded-2xl bg-gray-200" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-40 rounded-2xl bg-gray-200" />
        ))}
      </div>
      <div className="h-40 rounded-2xl bg-gray-200" />
    </section>
  )
}
